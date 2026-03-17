import { createClient } from '@/lib/supabase/server'

export async function getUserData(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function getUserDonations(userId: string, limit = 10) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('donations')
    .select(
      `
      *,
      donation_targets (
        name,
        image_url
      )
    `
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data
}

/** 최근 1주일 적립 알림 (알림 버튼용) */
export type PointNotificationRow = {
  transaction_id: string
  amount: number
  description: string | null
  created_at: string
}

/** 보상 선택 대기 알림 (복수 보상 이벤트 승인 후, 제출자용) */
export type PendingRewardChoiceRow = {
  type: 'PENDING_REWARD'
  submission_id: string
  event_id: string
  event_title: string
  round_number: number | null
  reviewed_at: string
}

/** 칭찬 수신자용: 보낸 사람이 보상 선택 시 포인트 지급 (CHOICE/BOTH 이벤트) */
export type PendingRecipientRewardRow = {
  type: 'PENDING_RECIPIENT_REWARD'
  submission_id: string
  event_id: string
  event_title: string
  round_number: number | null
  reviewed_at: string
}

/** 알림 버튼용: 적립 내역 + 보상 선택 대기 (통합) */
export type NotificationItem =
  | (PointNotificationRow & { type?: 'EARNED' })
  | PendingRewardChoiceRow
  | PendingRecipientRewardRow

export async function getPendingRewardChoiceNotifications(
  userId: string
): Promise<PendingRewardChoiceRow[]> {
  const supabase = await createClient()
  const { data: subs, error: subsError } = await supabase
    .from('event_submissions')
    .select('submission_id, event_id, round_id, status, reward_received, reviewed_at')
    .eq('user_id', userId)
    .eq('status', 'APPROVED')
    .eq('reward_received', false)
    .is('deleted_at', null)
    .not('reviewed_at', 'is', null)

  if (subsError || !subs?.length) return []

  const eventIds = [...new Set(subs.map((s) => s.event_id))]
  const { data: events } = await supabase
    .from('events')
    .select('event_id, title, reward_type')
    .in('event_id', eventIds)
    .is('deleted_at', null)
  const eventTitleBy = new Map((events ?? []).map((e) => [e.event_id, e.title]))
  const choiceByRewardType = new Set(
    (events ?? []).filter((e) => e.reward_type === 'CHOICE').map((e) => e.event_id)
  )
  const { data: rewardsByEvent } = await supabase
    .from('event_rewards')
    .select('event_id')
    .in('event_id', eventIds)
    .is('deleted_at', null)
  const rewardCountByEvent = new Map<string, number>()
  for (const r of rewardsByEvent ?? []) {
    rewardCountByEvent.set(r.event_id, (rewardCountByEvent.get(r.event_id) ?? 0) + 1)
  }
  const choiceByMultiReward = new Set([...rewardCountByEvent.entries()].filter(([, c]) => c > 1).map(([eid]) => eid))
  const choiceEventIds = new Set([...choiceByRewardType, ...choiceByMultiReward])
  const choiceSubs = subs.filter((s) => choiceEventIds.has(s.event_id))
  if (choiceSubs.length === 0) return []

  const roundIds = choiceSubs.map((s) => s.round_id).filter(Boolean) as string[]
  let roundNumberBy = new Map<string, number>()
  if (roundIds.length > 0) {
    const { data: rounds } = await supabase
      .from('event_rounds')
      .select('round_id, round_number')
      .in('round_id', roundIds)
      .is('deleted_at', null)
    for (const r of rounds ?? []) roundNumberBy.set(r.round_id, r.round_number)
  }

  return choiceSubs.map((s) => ({
    type: 'PENDING_REWARD' as const,
    submission_id: s.submission_id,
    event_id: s.event_id,
    event_title: eventTitleBy.get(s.event_id) ?? '이벤트',
    round_number: s.round_id ? roundNumberBy.get(s.round_id) ?? null : null,
    reviewed_at: s.reviewed_at!,
  }))
}

/** 칭찬 수신자용: 나에게 보낸 칭찬이 승인됐으나 보낸 사람이 아직 보상 미선택 (CHOICE/BOTH) */
export async function getPendingRecipientRewardNotifications(
  userId: string
): Promise<PendingRecipientRewardRow[]> {
  const supabase = await createClient()
  const { data: subs, error: subsError } = await supabase
    .from('event_submissions')
    .select('submission_id, event_id, round_id, status, reward_received, reviewed_at')
    .eq('peer_user_id', userId)
    .eq('status', 'APPROVED')
    .eq('reward_received', false)
    .is('deleted_at', null)
    .not('reviewed_at', 'is', null)

  if (subsError || !subs?.length) return []

  const eventIds = [...new Set(subs.map((s) => s.event_id))]
  const { data: events } = await supabase
    .from('events')
    .select('event_id, title, reward_type, reward_policy')
    .in('event_id', eventIds)
    .is('deleted_at', null)
  const eventTitleBy = new Map((events ?? []).map((e) => [e.event_id, e.title]))
  const bothEventIds = new Set((events ?? []).filter((e) => e.reward_policy === 'BOTH').map((e) => e.event_id))
  const choiceByRewardType = new Set(
    (events ?? []).filter((e) => e.reward_type === 'CHOICE').map((e) => e.event_id)
  )
  const { data: rewardsByEvent } = await supabase
    .from('event_rewards')
    .select('event_id')
    .in('event_id', eventIds)
    .is('deleted_at', null)
  const rewardCountByEvent = new Map<string, number>()
  for (const r of rewardsByEvent ?? []) {
    rewardCountByEvent.set(r.event_id, (rewardCountByEvent.get(r.event_id) ?? 0) + 1)
  }
  const choiceByMultiReward = new Set([...rewardCountByEvent.entries()].filter(([, c]) => c > 1).map(([eid]) => eid))
  const choiceEventIds = new Set([...choiceByRewardType, ...choiceByMultiReward])
  const recipientChoiceSubs = subs.filter(
    (s) => bothEventIds.has(s.event_id) && choiceEventIds.has(s.event_id)
  )
  if (recipientChoiceSubs.length === 0) return []

  const roundIds = recipientChoiceSubs.map((s) => s.round_id).filter(Boolean) as string[]
  let roundNumberBy = new Map<string, number>()
  if (roundIds.length > 0) {
    const { data: rounds } = await supabase
      .from('event_rounds')
      .select('round_id, round_number')
      .in('round_id', roundIds)
      .is('deleted_at', null)
    for (const r of rounds ?? []) roundNumberBy.set(r.round_id, r.round_number)
  }

  return recipientChoiceSubs.map((s) => ({
    type: 'PENDING_RECIPIENT_REWARD' as const,
    submission_id: s.submission_id,
    event_id: s.event_id,
    event_title: eventTitleBy.get(s.event_id) ?? '이벤트',
    round_number: s.round_id ? roundNumberBy.get(s.round_id) ?? null : null,
    reviewed_at: s.reviewed_at!,
  }))
}

export async function getRecentPointNotifications(
  userId: string,
  days = 7
): Promise<PointNotificationRow[]> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  const { data, error } = await supabase
    .from('point_transactions')
    .select('transaction_id, amount, description, created_at')
    .eq('user_id', userId)
    .eq('type', 'EARNED')
    .is('deleted_at', null)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return []
  return (data ?? []) as PointNotificationRow[]
}

/** 알림 버튼용: 적립 내역 + 보상 선택 대기 통합 (최신순) */
export async function getNotificationsForBell(
  userId: string,
  days = 7
): Promise<NotificationItem[]> {
  const [earned, pendingRewards, pendingRecipientRewards] = await Promise.all([
    getRecentPointNotifications(userId, days),
    getPendingRewardChoiceNotifications(userId),
    getPendingRecipientRewardNotifications(userId),
  ])
  const earnedItems: NotificationItem[] = earned.map((e) => ({ ...e, type: 'EARNED' as const }))
  const pendingItems: NotificationItem[] = [...pendingRewards, ...pendingRecipientRewards]
  const combined = [...earnedItems, ...pendingItems].sort((a, b) => {
    const aAt = 'transaction_id' in a ? a.created_at : a.reviewed_at
    const bAt = 'transaction_id' in b ? b.created_at : b.reviewed_at
    return new Date(bAt).getTime() - new Date(aAt).getTime()
  })
  return combined.slice(0, 30)
}

export async function getUserPointTransactions(userId: string, limit = 20) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data
}

/** 마이페이지용: 사용자의 이벤트 인증 제출 내역 (이벤트명, 구간, 상태, 반려 사유) */
export type UserEventSubmissionRow = {
  submission_id: string
  event_id: string
  event_title: string
  round_number: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejection_reason: string | null
  created_at: string
}

export async function getUserEventSubmissions(
  userId: string,
  limit = 30
): Promise<UserEventSubmissionRow[]> {
  const supabase = await createClient()

  const { data: subs, error: subsError } = await supabase
    .from('event_submissions')
    .select('submission_id, event_id, round_id, status, rejection_reason, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (subsError || !subs?.length) return []

  const eventIds = [...new Set(subs.map((s) => s.event_id))]
  const { data: events } = await supabase
    .from('events')
    .select('event_id, title')
    .in('event_id', eventIds)
    .is('deleted_at', null)
  const eventTitleBy = new Map((events ?? []).map((e) => [e.event_id, e.title]))

  const roundIds = subs.map((s) => s.round_id).filter(Boolean) as string[]
  let roundNumberBy = new Map<string, number>()
  if (roundIds.length > 0) {
    const { data: rounds } = await supabase
      .from('event_rounds')
      .select('round_id, round_number')
      .in('round_id', roundIds)
      .is('deleted_at', null)
    roundNumberBy = new Map((rounds ?? []).map((r) => [r.round_id, r.round_number]))
  }

  return subs.map((s) => ({
    submission_id: s.submission_id,
    event_id: s.event_id,
    event_title: eventTitleBy.get(s.event_id) ?? '(이벤트)',
    round_number: s.round_id ? roundNumberBy.get(s.round_id) ?? null : null,
    status: s.status,
    rejection_reason: s.rejection_reason,
    created_at: s.created_at,
  }))
}

/** 마이페이지용: 나에게 보낸 칭찬(peer_user_id = 나, 승인된 건만). 칭찬 내용(메시지) 포함 */
export type ReceivedComplimentRow = {
  submission_id: string
  event_id: string
  event_title: string
  /** 칭찬 메시지 (TEXT 인증 항목 또는 구 형식 PEER_SELECT 항목) */
  message: string
  /** 익명 칭찬 여부 (수신자에게는 익명으로 표시) */
  is_anonymous: boolean
  /** 익명이 아닐 때만: 보낸 사람 이름 (user_id로 조회) */
  sender_name: string | null
  created_at: string
}

export async function getReceivedCompliments(
  userId: string,
  limit = 50
): Promise<ReceivedComplimentRow[]> {
  const supabase = await createClient()

  const { data: subs, error: subsError } = await supabase
    .from('event_submissions')
    .select('submission_id, event_id, user_id, verification_data, is_anonymous, created_at')
    .eq('peer_user_id', userId)
    .eq('status', 'APPROVED')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (subsError || !subs?.length) return []

  const eventIds = [...new Set(subs.map((s) => s.event_id))]
  const senderIds = [...new Set((subs as { user_id?: string }[]).map((s) => s.user_id).filter(Boolean))] as string[]

  const [eventsRes, usersRes, methodsRes] = await Promise.all([
    supabase.from('events').select('event_id, title').in('event_id', eventIds).is('deleted_at', null),
    senderIds.length > 0 ? supabase.from('users').select('user_id, name').in('user_id', senderIds).is('deleted_at', null) : { data: [] },
    supabase.from('event_verification_methods').select('event_id, method_id, method_type').in('event_id', eventIds).is('deleted_at', null),
  ])

  const eventTitleBy = new Map((eventsRes.data ?? []).map((e) => [e.event_id, e.title]))
  const senderNameBy = new Map((usersRes.data ?? []).map((u) => [u.user_id, u.name ?? null]))
  /** 칭찬 메시지: 새 형식은 TEXT 항목, 구 형식은 PEER_SELECT 항목에 저장됨 (하위 호환) */
  const peerEventIds = new Set<string>()
  const textMethodByEvent = new Map<string, string>()
  const peerSelectMethodByEvent = new Map<string, string>()
  for (const m of methodsRes.data ?? []) {
    const evId = (m as { event_id: string }).event_id
    if ((m as { method_type?: string }).method_type === 'PEER_SELECT') {
      peerEventIds.add(evId)
      peerSelectMethodByEvent.set(evId, (m as { method_id: string }).method_id)
    }
  }
  for (const m of methodsRes.data ?? []) {
    const evId = (m as { event_id: string }).event_id
    if (peerEventIds.has(evId) && (m as { method_type?: string }).method_type === 'TEXT' && !textMethodByEvent.has(evId)) {
      textMethodByEvent.set(evId, (m as { method_id: string }).method_id)
    }
  }

  return subs.map((s) => {
    const vd = (s.verification_data as Record<string, unknown>) ?? {}
    const textMethodId = textMethodByEvent.get(s.event_id)
    const peerMethodId = peerSelectMethodByEvent.get(s.event_id)
    const textVal = textMethodId && vd[textMethodId] != null ? String(vd[textMethodId]).trim() : ''
    const peerVal = peerMethodId && vd[peerMethodId] != null ? String(vd[peerMethodId]).trim() : ''
    const message = textVal || (peerVal && !/^[0-9a-f-]{36}$/i.test(peerVal) ? peerVal : '') // 구 형식: PEER_SELECT에 텍스트 저장
    const isAnonymous = s.is_anonymous ?? false
    const senderId = (s as { user_id?: string }).user_id
    const sender_name = !isAnonymous && senderId ? (senderNameBy.get(senderId) ?? null) : null
    return {
      submission_id: s.submission_id,
      event_id: s.event_id,
      event_title: eventTitleBy.get(s.event_id) ?? '칭찬 챌린지',
      message,
      is_anonymous: isAnonymous,
      sender_name,
      created_at: s.created_at,
    }
  })
}
