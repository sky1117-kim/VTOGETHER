'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type ShopOrderAdminRow = {
  order_id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  dept_name: string | null
  product_id: string
  product_snapshot_name: string
  product_type: 'GOODS' | 'CREDIT_PACK' | 'ALMAENG_STORE'
  payment_medal: number
  credit_granted: number
  status: string
  created_at: string
}

export type ShopOrderKindFilter = 'ALL' | 'PHYSICAL' | 'CREDIT_PACK'

/** 관리자: 상점 주문(누가 무엇을 샀는지) 목록 — shop_orders + users 조합 */
export async function getShopOrdersForAdmin(options: {
  kind?: ShopOrderKindFilter
  q?: string
  page?: number
  pageSize?: number
}): Promise<{
  data: ShopOrderAdminRow[]
  total: number
  page: number
  pageSize: number
  error: string | null
}> {
  const page = Number.isFinite(options.page) && (options.page ?? 1) > 0 ? Math.floor(options.page!) : 1
  const pageSize =
    Number.isFinite(options.pageSize) && (options.pageSize ?? 50) > 0
      ? Math.min(Math.floor(options.pageSize!), 100)
      : 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const kind: ShopOrderKindFilter = options.kind === 'PHYSICAL' || options.kind === 'CREDIT_PACK' ? options.kind : 'ALL'
  const qRaw = (options.q ?? '').trim()
  const qSafe = qRaw.replace(/[%_,]/g, ' ').trim()

  try {
    const admin = createAdminClient()

    let userIdsFromSearch: string[] = []
    if (qSafe.length > 0) {
      const { data: matchedUsers, error: uErr } = await admin
        .from('users')
        .select('user_id')
        .is('deleted_at', null)
        .or(`name.ilike.%${qSafe}%,email.ilike.%${qSafe}%`)
        .limit(200)
      if (uErr) return { data: [], total: 0, page, pageSize, error: uErr.message }
      userIdsFromSearch = (matchedUsers ?? []).map((r) => String((r as { user_id: string }).user_id))
    }

    let query = admin
      .from('shop_orders')
      .select(
        'order_id, user_id, product_id, product_snapshot_name, product_type, payment_medal, credit_granted, status, created_at',
        { count: 'exact' }
      )
      .eq('status', 'COMPLETED')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (kind === 'PHYSICAL') {
      query = query.in('product_type', ['GOODS', 'ALMAENG_STORE'])
    } else if (kind === 'CREDIT_PACK') {
      query = query.eq('product_type', 'CREDIT_PACK')
    }

    if (qSafe.length > 0) {
      const productPat = `product_snapshot_name.ilike.%${qSafe}%`
      const uidSlice = userIdsFromSearch.slice(0, 80)
      if (uidSlice.length > 0) {
        query = query.or(`${productPat},user_id.in.(${uidSlice.join(',')})`)
      } else {
        query = query.ilike('product_snapshot_name', `%${qSafe}%`)
      }
    }

    const { data: orderRows, count, error } = await query.range(from, to)
    if (error) return { data: [], total: 0, page, pageSize, error: error.message }

    const orders = (orderRows ?? []) as Omit<ShopOrderAdminRow, 'user_name' | 'user_email' | 'dept_name'>[]
    const ids = [...new Set(orders.map((o) => o.user_id))]

    const userMap = new Map<string, { name: string | null; email: string | null; dept_name: string | null }>()
    if (ids.length > 0) {
      const { data: users, error: u2 } = await admin
        .from('users')
        .select('user_id, name, email, dept_name')
        .in('user_id', ids)
        .is('deleted_at', null)
      if (u2) return { data: [], total: 0, page, pageSize, error: u2.message }
      for (const r of users ?? []) {
        const row = r as { user_id: string; name: string | null; email: string | null; dept_name: string | null }
        userMap.set(row.user_id, { name: row.name, email: row.email, dept_name: row.dept_name })
      }
    }

    const data: ShopOrderAdminRow[] = orders.map((o) => {
      const u = userMap.get(o.user_id)
      return {
        ...o,
        user_name: u?.name ?? null,
        user_email: u?.email ?? null,
        dept_name: u?.dept_name ?? null,
      }
    })

    return { data, total: count ?? 0, page, pageSize, error: null }
  } catch (e) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      error: e instanceof Error ? e.message : '상점 주문 조회 실패',
    }
  }
}
