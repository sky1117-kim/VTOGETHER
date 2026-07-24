'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduleEarnedNotificationEmail } from '@/lib/send-earned-notification-email'

type ShopProductRow = {
  product_id: string
  name: string
  description: string | null
  product_type: 'GOODS' | 'CREDIT_PACK' | 'ALMAENG_STORE'
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

/** RPC 응답: docs/migrations/053-shop-purchase-atomic-rpc.sql 참고 */
type PurchaseShopProductRpcResult = {
  success: boolean
  productName: string
  totalCreditGranted: number
  creditTransactionId: string | null
  userEmail: string | null
  userName: string | null
}

export async function purchaseShopProduct(productId: string, quantity = 1): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const safeQuantity = Math.max(1, Math.floor(quantity))
    if (!Number.isFinite(safeQuantity) || safeQuantity > 99) {
      return { success: false, error: '수량이 올바르지 않습니다.' }
    }
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return { success: false, error: '로그인이 필요합니다.' }

    const admin = createAdminClient()
    // 잔액 확인·차감, 재고 확인·차감, 주문/거래 기록을 DB 트랜잭션 안에서 원자적으로 처리합니다.
    // (별개의 조회 후 갱신으로 처리하면 동시 요청 시 잔액/재고 이중 차감이 가능해집니다.)
    const { data, error } = await admin.rpc('purchase_shop_product_atomic', {
      p_product_id: productId,
      p_quantity: safeQuantity,
      p_user_id: user.id,
    })
    if (error) return { success: false, error: error.message }

    const result = data as PurchaseShopProductRpcResult

    if (result.totalCreditGranted > 0) {
      scheduleEarnedNotificationEmail({
        toEmail: result.userEmail,
        userName: result.userName,
        description: `V.Medal 전환: ${result.productName} x${safeQuantity}`,
        amount: result.totalCreditGranted,
        currencyType: 'V_CREDIT',
        transactionId: result.creditTransactionId ?? undefined,
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
