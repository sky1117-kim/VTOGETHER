import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleAuth, JWT } from 'google-auth-library'

// 주의: 이 파일은 의도적으로 'use server'를 쓰지 않습니다.
// syncEsgOrdersToSheet()은 크론 시크릿(SHOP_ORDERS_ESG_SHEET_CRON_SECRET)으로 보호되는
// app/api/cron/shop-orders-esg-sheet/route.ts에서만 호출되어야 하며, 'use server'로 내보내면
// 로그인 세션 없이도 호출 가능한 공개 Server Action이 되어 크론 보호를 우회할 수 있습니다.

/** ESG 주문 구글시트 동기화 시작 기준일 (2026-09-17 요청 시점부터) */
const SYNC_SINCE = '2026-09-17T00:00:00+09:00'

const HEADER = ['주문ID', '주문일시', '이름', '이메일', '부서', '상품명', '옵션', '메달', '상태', '지급여부']

type EsgOrderRow = {
  order_id: string
  user_id: string
  product_snapshot_name: string
  payment_medal: number
  status: string
  fulfilled_at: string | null
  variant_color: string | null
  variant_size: string | null
  created_at: string
}

export type EsgSheetSyncResult = {
  success: boolean
  error?: string
  added?: number
}

function formatSeoulDateTime(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace(',', '')
}

// googleapis 패키지는 쓰지 않음: 수백 개 구글 API의 타입 정의를 통째로 끌고 와
// `next build`의 TypeScript 체크 단계에서 힙 메모리를 과도하게 소모해 Cloud Build가
// OOM으로 실패했음. 인증만 google-auth-library로 처리하고 Sheets API는 REST로 직접 호출.
const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

async function getAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n')

  // 키 파일(JSON) 대신 Cloud Run에 붙인 서비스 계정(sheet-bot)으로 자동 인증(ADC)하는 것을 기본값으로 함.
  // GOOGLE_SHEETS_CLIENT_EMAIL/PRIVATE_KEY를 명시적으로 설정한 경우에만 키 기반 인증으로 대체.
  const auth =
    clientEmail && privateKey
      ? new JWT({ email: clientEmail, key: privateKey, scopes: SHEETS_SCOPES })
      : new GoogleAuth({ scopes: SHEETS_SCOPES })

  const client = auth instanceof JWT ? auth : await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('구글 액세스 토큰 발급 실패')
  return token
}

function getSheetsConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEETS_SPREADSHEET_ID')
  const tabPrefix = process.env.GOOGLE_SHEETS_ESG_TAB_NAME?.trim()
  return { spreadsheetId, tabPrefix }
}

async function sheetsFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`구글시트 API 오류 (${res.status}): ${body.slice(0, 500)}`)
  }
  return res.json()
}

/** 구매 처리 흐름에서 실패해도 구매 자체는 성공 처리되도록 fire-and-forget으로 호출 (적립 알림 메일과 동일한 패턴) */
export function scheduleEsgSheetSync(): void {
  void syncEsgOrdersToSheet().then((result) => {
    if (!result.success) console.error('[ESG Sheet] 구글시트 동기화 실패:', result.error)
  })
}

/** ESG 상점 주문(오늘 이후 발생분)을 구글시트에 신규 행만 추가 동기화 */
export async function syncEsgOrdersToSheet(): Promise<EsgSheetSyncResult> {
  try {
    const admin = createAdminClient()
    const { data: orderRows, error } = await admin
      .from('shop_orders')
      .select(
        'order_id, user_id, product_snapshot_name, payment_medal, status, fulfilled_at, variant_color, variant_size, created_at'
      )
      .eq('product_type', 'ESG')
      .is('deleted_at', null)
      .gte('created_at', SYNC_SINCE)
      .order('created_at', { ascending: true })
    if (error) return { success: false, error: error.message }

    const orders = (orderRows ?? []) as EsgOrderRow[]
    if (orders.length === 0) return { success: true, added: 0 }

    const userIds = [...new Set(orders.map((o) => o.user_id))]
    const userMap = new Map<string, { name: string | null; email: string | null; dept_name: string | null }>()
    if (userIds.length > 0) {
      const { data: users, error: uErr } = await admin
        .from('users')
        .select('user_id, name, email, dept_name')
        .in('user_id', userIds)
      if (uErr) return { success: false, error: uErr.message }
      for (const r of users ?? []) {
        const row = r as { user_id: string; name: string | null; email: string | null; dept_name: string | null }
        userMap.set(row.user_id, { name: row.name, email: row.email, dept_name: row.dept_name })
      }
    }

    const { spreadsheetId, tabPrefix } = getSheetsConfig()
    const range = (a1: string) => (tabPrefix ? `${tabPrefix}!${a1}` : a1)
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
    const token = await getAccessToken()

    const existing = (await sheetsFetch(`${base}/values/${encodeURIComponent(range('A:A'))}`, token)) as {
      values?: string[][]
    }
    const existingIds = new Set((existing.values ?? []).map((r) => r[0]))

    if (existingIds.size === 0) {
      await sheetsFetch(`${base}/values/${encodeURIComponent(range('A1:J1'))}?valueInputOption=RAW`, token, {
        method: 'PUT',
        body: JSON.stringify({ values: [HEADER] }),
      })
    }

    const newOrders = orders.filter((o) => !existingIds.has(o.order_id))
    if (newOrders.length === 0) return { success: true, added: 0 }

    const rows = newOrders.map((o) => {
      const u = userMap.get(o.user_id)
      const variant = [o.variant_color, o.variant_size].filter(Boolean).join(' / ')
      return [
        o.order_id,
        formatSeoulDateTime(o.created_at),
        u?.name ?? '',
        u?.email ?? '',
        u?.dept_name ?? '',
        o.product_snapshot_name,
        variant,
        o.payment_medal,
        o.status === 'CANCELLED' ? '취소' : '완료',
        o.fulfilled_at ? '지급완료' : '미지급',
      ]
    })

    await sheetsFetch(
      `${base}/values/${encodeURIComponent(range('A:J'))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      token,
      { method: 'POST', body: JSON.stringify({ values: rows }) }
    )

    return { success: true, added: rows.length }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'ESG 주문 시트 동기화 실패' }
  }
}
