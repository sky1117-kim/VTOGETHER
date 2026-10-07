'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuctionCategory = 'LAPTOP' | 'MONITOR' | 'ETC'
export type AuctionEventStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED'

export type AuctionItemForUser = {
  item_id: string
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
  display_order: number
  starting_price: number
  min_bid_increment: number
  current_highest_bid: number | null
  current_highest_bid_at: string | null
  bid_count: number
  is_current_highest_bidder_me: boolean
  already_bid_today: boolean
  my_bid_today_amount: number | null
  winner_name: string | null
}

export type AuctionEventForUser = {
  event_id: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  status: AuctionEventStatus
}

const CATEGORY_DISPLAY_ORDER: Record<AuctionCategory, number> = { LAPTOP: 0, MONITOR: 1, ETC: 2 }

function resolveEventStatus(startAt: string, endAt: string): AuctionEventStatus {
  const now = Date.now()
  if (now < new Date(startAt).getTime()) return 'UPCOMING'
  if (now > new Date(endAt).getTime()) return 'CLOSED'
  return 'ACTIVE'
}

/** 현재 노출할 경매 이벤트(진행 중인 것 우선, 없으면 가장 최근 것)와 품목 목록 */
export async function getCurrentAuctionEvent(): Promise<{
  event: AuctionEventForUser | null
  items: AuctionItemForUser[]
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? null

    const admin = createAdminClient()
    const { data: events, error: eventsError } = await admin
      .from('auction_events')
      .select('event_id, title, description, start_at, end_at')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('start_at', { ascending: false })
    if (eventsError) return { event: null, items: [], error: eventsError.message }
    if (!events || events.length === 0) return { event: null, items: [], error: null }

    type EventRow = { event_id: string; title: string; description: string | null; start_at: string; end_at: string }
    const rows = events as EventRow[]
    const now = Date.now()
    const active = rows.find((e) => now >= new Date(e.start_at).getTime() && now <= new Date(e.end_at).getTime())
    const upcoming = rows
      .filter((e) => now < new Date(e.start_at).getTime())
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0]
    const eventRow = active ?? upcoming ?? rows[0]

    const status = resolveEventStatus(eventRow.start_at, eventRow.end_at)

    const { data: itemRows, error: itemsError } = await admin
      .from('auction_items')
      .select(
        'item_id, name, model_name, category, image_url, image_url_2, description, size, manufacture_date, serial_number, has_adapter, spec_detail, functional_notes, display_order, starting_price, min_bid_increment, current_highest_bid, current_highest_bidder_id, current_highest_bid_at'
      )
      .eq('event_id', eventRow.event_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (itemsError) return { event: null, items: [], error: itemsError.message }

    type ItemRow = {
      item_id: string
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
      display_order: number
      starting_price: number
      min_bid_increment: number
      current_highest_bid: number | null
      current_highest_bidder_id: string | null
      current_highest_bid_at: string | null
    }
    const items = (itemRows ?? []) as ItemRow[]
    const itemIds = items.map((i) => i.item_id)

    const bidCountByItem = new Map<string, number>()
    const myBidTodayAmountByItem = new Map<string, number>()

    if (itemIds.length > 0) {
      const { data: bidRows } = await admin
        .from('auction_bids')
        .select('item_id, user_id, bid_date, bid_amount')
        .in('item_id', itemIds)
      const rows2 = (bidRows ?? []) as Array<{ item_id: string; user_id: string; bid_date: string; bid_amount: number }>
      for (const row of rows2) {
        bidCountByItem.set(row.item_id, (bidCountByItem.get(row.item_id) ?? 0) + 1)
      }
      if (userId) {
        const todayKst = new Date(
          new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
        )
        const todayStr = `${todayKst.getFullYear()}-${String(todayKst.getMonth() + 1).padStart(2, '0')}-${String(
          todayKst.getDate()
        ).padStart(2, '0')}`
        for (const row of rows2) {
          if (row.user_id === userId && row.bid_date === todayStr) {
            myBidTodayAmountByItem.set(row.item_id, row.bid_amount)
          }
        }
      }
    }

    const winnerIds = status === 'CLOSED' ? [...new Set(items.map((i) => i.current_highest_bidder_id).filter((v): v is string => !!v))] : []
    const winnerNameMap = new Map<string, string>()
    if (winnerIds.length > 0) {
      const { data: winnerUsers } = await admin.from('users').select('user_id, name, email').in('user_id', winnerIds)
      for (const row of (winnerUsers ?? []) as Array<{ user_id: string; name: string | null; email: string | null }>) {
        winnerNameMap.set(row.user_id, row.name || row.email || '알 수 없음')
      }
    }

    const result: AuctionItemForUser[] = items.map((i) => ({
      item_id: i.item_id,
      name: i.name,
      model_name: i.model_name,
      category: i.category,
      image_url: i.image_url,
      image_url_2: i.image_url_2,
      description: i.description,
      size: i.size,
      manufacture_date: i.manufacture_date,
      serial_number: i.serial_number,
      has_adapter: i.has_adapter,
      spec_detail: i.spec_detail,
      functional_notes: i.functional_notes,
      display_order: i.display_order,
      starting_price: i.starting_price,
      min_bid_increment: i.min_bid_increment,
      current_highest_bid: i.current_highest_bid,
      current_highest_bid_at: i.current_highest_bid_at,
      bid_count: bidCountByItem.get(i.item_id) ?? 0,
      is_current_highest_bidder_me: !!userId && i.current_highest_bidder_id === userId,
      already_bid_today: myBidTodayAmountByItem.has(i.item_id),
      my_bid_today_amount: myBidTodayAmountByItem.get(i.item_id) ?? null,
      winner_name: status === 'CLOSED' ? winnerNameMap.get(i.current_highest_bidder_id ?? '') ?? null : null,
    }))

    result.sort((a, b) => CATEGORY_DISPLAY_ORDER[a.category] - CATEGORY_DISPLAY_ORDER[b.category] || a.display_order - b.display_order)

    return {
      event: {
        event_id: eventRow.event_id,
        title: eventRow.title,
        description: eventRow.description,
        start_at: eventRow.start_at,
        end_at: eventRow.end_at,
        status,
      },
      items: result,
      error: null,
    }
  } catch (e) {
    return { event: null, items: [], error: e instanceof Error ? e.message : '경매 정보 조회 실패' }
  }
}

export async function placeAuctionBid(
  itemId: string,
  bidAmount: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const safeAmount = Math.floor(bidAmount)
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      return { success: false, error: '입찰가가 올바르지 않습니다.' }
    }
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return { success: false, error: '로그인이 필요합니다.' }

    const admin = createAdminClient()
    const { error } = await admin.rpc('place_auction_bid_atomic', {
      p_item_id: itemId,
      p_user_id: user.id,
      p_bid_amount: safeAmount,
    })
    if (error) return { success: false, error: error.message }

    revalidatePath('/auction')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '입찰 처리 실패' }
  }
}
