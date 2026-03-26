'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ShopProductRow = {
  product_id: string
  name: string
  description: string | null
  product_type: 'GOODS' | 'CREDIT_PACK'
  price_medal: number
  credit_amount: number | null
  stock: number | null
  image_url: string | null
  is_active: boolean
  created_at: string
  order_count: number
  is_new: boolean
  is_best: boolean
}

export async function getShopProducts(): Promise<{
  data: ShopProductRow[] | null
  error: string | null
}> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('shop_products')
      .select('product_id, name, description, product_type, price_medal, credit_amount, stock, image_url, is_active, created_at')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) return { data: null, error: error.message }

    const rows = (data ?? []) as Array<Omit<ShopProductRow, 'order_count' | 'is_new' | 'is_best'>>
    const { data: orderRows } = await admin
      .from('shop_orders')
      .select('product_id')
      .is('deleted_at', null)
      .eq('status', 'COMPLETED')

    const orderCountMap = new Map<string, number>()
    for (const row of orderRows ?? []) {
      const productId = String((row as { product_id?: string }).product_id ?? '')
      if (!productId) continue
      orderCountMap.set(productId, (orderCountMap.get(productId) ?? 0) + 1)
    }
    const bestProductId = Array.from(orderCountMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const now = Date.now()
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000

    const enriched: ShopProductRow[] = rows.map((row) => {
      const createdAtMs = new Date(row.created_at).getTime()
      const isNew = Number.isFinite(createdAtMs) ? now - createdAtMs <= fourteenDaysMs : false
      const orderCount = orderCountMap.get(row.product_id) ?? 0
      return {
        ...row,
        order_count: orderCount,
        is_new: isNew,
        is_best: bestProductId != null && bestProductId === row.product_id && orderCount > 0,
      }
    })

    return { data: enriched, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '상점 목록 조회 실패' }
  }
}

export async function purchaseShopProduct(productId: string): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return { success: false, error: '로그인이 필요합니다.' }

    const admin = createAdminClient()
    const { data: me, error: meErr } = await admin
      .from('users')
      .select('current_medals')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()
    if (meErr || !me) return { success: false, error: '사용자 정보를 찾을 수 없습니다.' }

    const { data: product, error: productErr } = await admin
      .from('shop_products')
      .select('product_id, name, product_type, price_medal, credit_amount, stock, is_active')
      .eq('product_id', productId)
      .is('deleted_at', null)
      .single()
    if (productErr || !product || !product.is_active) return { success: false, error: '구매 가능한 상품이 아닙니다.' }
    if (product.stock != null && product.stock <= 0) return { success: false, error: '재고가 부족합니다.' }
    if ((me.current_medals ?? 0) < product.price_medal) return { success: false, error: 'V.Medal이 부족합니다.' }

    const { error: debitErr } = await admin
      .from('users')
      .update({ current_medals: (me.current_medals ?? 0) - product.price_medal })
      .eq('user_id', user.id)
    if (debitErr) return { success: false, error: 'V.Medal 차감 실패' }

    if (product.stock != null) {
      await admin.from('shop_products').update({ stock: product.stock - 1 }).eq('product_id', product.product_id)
    }

    const creditGranted = product.product_type === 'CREDIT_PACK' ? Number(product.credit_amount ?? 0) : 0
    const { error: orderErr } = await admin.from('shop_orders').insert({
      user_id: user.id,
      product_id: product.product_id,
      product_snapshot_name: product.name,
      product_type: product.product_type,
      payment_medal: product.price_medal,
      credit_granted: creditGranted,
      status: 'COMPLETED',
    })
    if (orderErr) return { success: false, error: `주문 저장 실패: ${orderErr.message}` }

    await admin.from('point_transactions').insert({
      user_id: user.id,
      type: 'USED',
      amount: -product.price_medal,
      currency_type: 'V_MEDAL',
      related_id: product.product_id,
      related_type: 'SHOP_PURCHASE',
      description: `상점 구매: ${product.name}`,
    })

    if (creditGranted > 0) {
      const { data: userRow } = await admin
        .from('users')
        .select('current_points')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single()
      const currentPoints = userRow?.current_points ?? 0
      await admin.from('users').update({ current_points: currentPoints + creditGranted }).eq('user_id', user.id)
      await admin.from('credit_lots').insert({
        user_id: user.id,
        source_type: 'MEDAL_EXCHANGE',
        initial_amount: creditGranted,
        remaining_amount: creditGranted,
        related_id: product.product_id,
        description: `V.Medal 전환 구매: ${product.name}`,
      })
      await admin.from('point_transactions').insert({
        user_id: user.id,
        type: 'EARNED',
        amount: creditGranted,
        currency_type: 'V_CREDIT',
        related_id: product.product_id,
        related_type: 'SHOP_EXCHANGE',
        description: `V.Medal 전환: ${product.name}`,
      })
    }

    revalidatePath('/shop')
    revalidatePath('/my')
    revalidatePath('/')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '구매 처리 실패' }
  }
}
