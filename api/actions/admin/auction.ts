'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectImageExtension } from '@/lib/validate-image-upload'

type AuctionCategory = 'LAPTOP' | 'MONITOR' | 'ETC'

const CATEGORY_DISPLAY_ORDER: Record<AuctionCategory, number> = { LAPTOP: 0, MONITOR: 1, ETC: 2 }

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

export type AuctionEventRow = {
  event_id: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  is_active: boolean
  created_at: string
}

export async function getAuctionEventsForAdmin(): Promise<{ data: AuctionEventRow[] | null; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { data: null, error: auth.error }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('auction_events')
    .select('event_id, title, description, start_at, end_at, is_active, created_at')
    .is('deleted_at', null)
    .order('start_at', { ascending: false })
  if (error) return { data: null, error: error.message }
  return { data: data ?? [], error: null }
}

export async function createAuctionEvent(input: {
  title: string
  description?: string | null
  start_at: string
  end_at: string
}): Promise<{ success: boolean; error: string | null; event_id: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error, event_id: null }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('auction_events')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      start_at: input.start_at,
      end_at: input.end_at,
      is_active: true,
      created_by: auth.userId,
    })
    .select('event_id')
    .single()
  if (error) return { success: false, error: error.message, event_id: null }

  revalidatePath('/admin/auction')
  revalidatePath('/auction')
  return { success: true, error: null, event_id: data.event_id as string }
}

export async function updateAuctionEvent(input: {
  event_id: string
  title: string
  description?: string | null
  start_at: string
  end_at: string
  is_active: boolean
}): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('auction_events')
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      start_at: input.start_at,
      end_at: input.end_at,
      is_active: input.is_active,
    })
    .eq('event_id', input.event_id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/auction')
  revalidatePath('/auction')
  return { success: true, error: null }
}

export async function deleteAuctionEvent(eventId: string): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin
    .from('auction_events')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('event_id', eventId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/auction')
  revalidatePath('/auction')
  return { success: true, error: null }
}

export type AuctionItemRow = {
  item_id: string
  event_id: string
  name: string
  model_name: string | null
  category: AuctionCategory
  image_url: string | null
  image_url_2: string | null
  description: string | null
  size: string | null
  manufacture_date: string | null
  serial_number: string | null
  has_adapter: boolean | null
  spec_detail: string | null
  functional_notes: string | null
  starting_price: number
  min_bid_increment: number
  current_highest_bid: number | null
  current_highest_bidder_id: string | null
  current_highest_bidder_name: string | null
  display_order: number
  is_active: boolean
}

export async function getAuctionItemsForAdmin(eventId: string): Promise<{ data: AuctionItemRow[] | null; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { data: null, error: auth.error }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('auction_items')
    .select(
      'item_id, event_id, name, model_name, category, image_url, image_url_2, description, size, manufacture_date, serial_number, has_adapter, spec_detail, functional_notes, starting_price, min_bid_increment, current_highest_bid, current_highest_bidder_id, display_order, is_active'
    )
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return { data: null, error: error.message }

  type Row = Omit<AuctionItemRow, 'current_highest_bidder_name'>
  const rows = (data ?? []) as Row[]
  const bidderIds = [...new Set(rows.map((r) => r.current_highest_bidder_id).filter((v): v is string => !!v))]
  const nameMap = new Map<string, string>()
  if (bidderIds.length > 0) {
    const { data: users } = await admin.from('users').select('user_id, name, email').in('user_id', bidderIds)
    for (const u of (users ?? []) as Array<{ user_id: string; name: string | null; email: string | null }>) {
      nameMap.set(u.user_id, u.name || u.email || '알 수 없음')
    }
  }

  const result: AuctionItemRow[] = rows.map((r) => ({
    ...r,
    current_highest_bidder_name: r.current_highest_bidder_id ? nameMap.get(r.current_highest_bidder_id) ?? null : null,
  }))
  result.sort((a, b) => CATEGORY_DISPLAY_ORDER[a.category] - CATEGORY_DISPLAY_ORDER[b.category] || a.display_order - b.display_order)
  return { data: result, error: null }
}

export async function createAuctionItem(input: {
  event_id: string
  name: string
  model_name?: string | null
  category: AuctionCategory
  image_url?: string | null
  image_url_2?: string | null
  description?: string | null
  size?: string | null
  manufacture_date?: string | null
  serial_number?: string | null
  has_adapter?: boolean | null
  spec_detail?: string | null
  functional_notes?: string | null
  starting_price: number
  min_bid_increment: number
  display_order?: number
}): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin.from('auction_items').insert({
    event_id: input.event_id,
    name: input.name.trim(),
    model_name: input.model_name?.trim() || null,
    category: input.category,
    image_url: input.image_url?.trim() || null,
    image_url_2: input.image_url_2?.trim() || null,
    description: input.description?.trim() || null,
    size: input.size?.trim() || null,
    manufacture_date: input.manufacture_date?.trim() || null,
    serial_number: input.serial_number?.trim() || null,
    has_adapter: input.category === 'MONITOR' ? input.has_adapter ?? null : null,
    spec_detail: input.spec_detail?.trim() || null,
    functional_notes: input.functional_notes?.trim() || null,
    starting_price: Math.max(1, Math.floor(input.starting_price)),
    min_bid_increment: Math.max(1, Math.floor(input.min_bid_increment)),
    display_order: Math.floor(input.display_order ?? 0),
    is_active: true,
  })
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/auction')
  revalidatePath('/auction')
  return { success: true, error: null }
}

export async function updateAuctionItem(input: {
  item_id: string
  name: string
  model_name?: string | null
  category: AuctionCategory
  image_url?: string | null
  image_url_2?: string | null
  description?: string | null
  size?: string | null
  manufacture_date?: string | null
  serial_number?: string | null
  has_adapter?: boolean | null
  spec_detail?: string | null
  functional_notes?: string | null
  starting_price: number
  min_bid_increment: number
  display_order?: number
  is_active: boolean
}): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('auction_items')
    .update({
      name: input.name.trim(),
      model_name: input.model_name?.trim() || null,
      category: input.category,
      image_url: input.image_url?.trim() || null,
      image_url_2: input.image_url_2?.trim() || null,
      description: input.description?.trim() || null,
      size: input.size?.trim() || null,
      manufacture_date: input.manufacture_date?.trim() || null,
      serial_number: input.serial_number?.trim() || null,
      has_adapter: input.category === 'MONITOR' ? input.has_adapter ?? null : null,
      spec_detail: input.spec_detail?.trim() || null,
      functional_notes: input.functional_notes?.trim() || null,
      starting_price: Math.max(1, Math.floor(input.starting_price)),
      min_bid_increment: Math.max(1, Math.floor(input.min_bid_increment)),
      display_order: Math.floor(input.display_order ?? 0),
      is_active: input.is_active,
    })
    .eq('item_id', input.item_id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/auction')
  revalidatePath('/auction')
  return { success: true, error: null }
}

export async function deleteAuctionItem(itemId: string): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin
    .from('auction_items')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('item_id', itemId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/auction')
  revalidatePath('/auction')
  return { success: true, error: null }
}

export async function uploadAuctionItemImage(formData: FormData): Promise<{ url: string | null; error: string | null }> {
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
    const path = `auction-items/${Date.now()}-${randomUUID()}.${detected.ext}`
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

export type AuctionBidAdminRow = {
  bid_id: string
  item_id: string
  item_name: string
  user_id: string
  user_name: string | null
  user_email: string | null
  dept_name: string | null
  bid_amount: number
  bid_date: string
  created_at: string
}

/** 관리자: 이벤트의 전체 입찰 기록 (최신순) — 정산/검증용 */
export async function getAuctionBidsForAdmin(eventId: string): Promise<{ data: AuctionBidAdminRow[]; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { data: [], error: auth.error }
  try {
    const admin = createAdminClient()
    const { data: items, error: itemsError } = await admin
      .from('auction_items')
      .select('item_id, name')
      .eq('event_id', eventId)
      .is('deleted_at', null)
    if (itemsError) return { data: [], error: itemsError.message }
    const itemNameMap = new Map<string, string>()
    for (const i of (items ?? []) as Array<{ item_id: string; name: string }>) itemNameMap.set(i.item_id, i.name)
    const itemIds = [...itemNameMap.keys()]
    if (itemIds.length === 0) return { data: [], error: null }

    const { data: bidRows, error: bidsError } = await admin
      .from('auction_bids')
      .select('bid_id, item_id, user_id, bid_amount, bid_date, created_at')
      .in('item_id', itemIds)
      .order('created_at', { ascending: false })
    if (bidsError) return { data: [], error: bidsError.message }

    const bids = (bidRows ?? []) as Array<{
      bid_id: string
      item_id: string
      user_id: string
      bid_amount: number
      bid_date: string
      created_at: string
    }>
    const userIds = [...new Set(bids.map((b) => b.user_id))]
    const userMap = new Map<string, { name: string | null; email: string | null; dept_name: string | null }>()
    if (userIds.length > 0) {
      const { data: users } = await admin.from('users').select('user_id, name, email, dept_name').in('user_id', userIds)
      for (const u of (users ?? []) as Array<{ user_id: string; name: string | null; email: string | null; dept_name: string | null }>) {
        userMap.set(u.user_id, { name: u.name, email: u.email, dept_name: u.dept_name })
      }
    }

    const data: AuctionBidAdminRow[] = bids.map((b) => {
      const u = userMap.get(b.user_id)
      return {
        bid_id: b.bid_id,
        item_id: b.item_id,
        item_name: itemNameMap.get(b.item_id) ?? '삭제된 품목',
        user_id: b.user_id,
        user_name: u?.name ?? null,
        user_email: u?.email ?? null,
        dept_name: u?.dept_name ?? null,
        bid_amount: b.bid_amount,
        bid_date: b.bid_date,
        created_at: b.created_at,
      }
    })
    return { data, error: null }
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : '입찰 내역 조회 실패' }
  }
}
