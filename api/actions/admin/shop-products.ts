'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectImageExtension } from '@/lib/validate-image-upload'

type ProductType = 'GOODS' | 'CREDIT_PACK' | 'ALMAENG_STORE'

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user?.id) return { ok: false, error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data: me, error } = await admin
    .from('users')
    .select('is_admin')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()
  if (error || !me?.is_admin) return { ok: false, error: '관리자 권한이 필요합니다.' }
  return { ok: true, userId: user.id }
}

export async function getShopProductsForAdmin() {
  const auth = await requireAdmin()
  if (!auth.ok) return { data: null, error: auth.error }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('shop_products')
    .select('product_id, name, description, product_type, price_medal, credit_amount, stock, image_url, is_active, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) return { data: null, error: error.message }
  return { data: data ?? [], error: null }
}

export async function createShopProduct(input: {
  name: string
  description?: string | null
  product_type: ProductType
  price_medal: number
  credit_amount?: number | null
  stock?: number | null
  image_url?: string | null
}) {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    product_type: input.product_type,
    price_medal: Math.max(1, Math.floor(input.price_medal)),
    credit_amount: input.product_type === 'CREDIT_PACK' ? Math.max(1, Math.floor(input.credit_amount ?? 0)) : null,
    stock: input.stock == null ? null : Math.max(0, Math.floor(input.stock)),
    image_url: input.image_url?.trim() || null,
    is_active: true,
    created_by: auth.userId,
  }
  const { error } = await admin.from('shop_products').insert(payload)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/shop-products')
  revalidatePath('/shop')
  return { success: true, error: null }
}

export async function updateShopProduct(input: {
  product_id: string
  name: string
  description?: string | null
  product_type: ProductType
  price_medal: number
  credit_amount?: number | null
  stock?: number | null
  image_url?: string | null
  is_active: boolean
}) {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('shop_products')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      product_type: input.product_type,
      price_medal: Math.max(1, Math.floor(input.price_medal)),
      credit_amount: input.product_type === 'CREDIT_PACK' ? Math.max(1, Math.floor(input.credit_amount ?? 0)) : null,
      stock: input.stock == null ? null : Math.max(0, Math.floor(input.stock)),
      image_url: input.image_url?.trim() || null,
      is_active: input.is_active,
    })
    .eq('product_id', input.product_id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/shop-products')
  revalidatePath('/shop')
  return { success: true, error: null }
}

export async function toggleShopProductActive(productId: string, isActive: boolean) {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin.from('shop_products').update({ is_active: isActive }).eq('product_id', productId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/shop-products')
  revalidatePath('/shop')
  return { success: true, error: null }
}

export async function uploadShopProductImage(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { url: null, error: auth.error }

  const file = formData.get('file') as File | null
  if (!file?.size) return { url: null, error: '파일을 선택하세요.' }
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) return { url: null, error: '파일은 5MB 이하여야 합니다.' }
  const detected = await detectImageExtension(file)
  if (detected.error) return { url: null, error: detected.error }

  try {
    const admin = createAdminClient()
    const path = `shop-products/${Date.now()}-${randomUUID()}.${detected.ext}`
    const { data, error } = await admin.storage.from('event-verification').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) return { url: null, error: error.message }
    const { data: urlData } = admin.storage.from('event-verification').getPublicUrl(data.path)
    return { url: urlData.publicUrl, error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : '업로드 실패' }
  }
}
