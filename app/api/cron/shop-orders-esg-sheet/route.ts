import { syncEsgOrdersToSheet } from '@/lib/shop-orders-esg-sheet-sync'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * ESG 상점 주문 → 구글시트 동기화 (수 분 간격 호출 권장)
 * - 보호: Authorization: Bearer ${SHOP_ORDERS_ESG_SHEET_CRON_SECRET}
 */
export async function GET(request: Request) {
  const secret = process.env.SHOP_ORDERS_ESG_SHEET_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'SHOP_ORDERS_ESG_SHEET_CRON_SECRET 미설정' },
      { status: 500 }
    )
  }

  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (!safeEqual(auth, expected)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncEsgOrdersToSheet()
  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}
