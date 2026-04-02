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
  currency_type: 'V_CREDIT' | 'V_MEDAL'
  description: string | null
  created_at: string
}

/** 알림 버튼용: 적립 내역 */
export type NotificationItem =
  | (PointNotificationRow & { type?: 'EARNED' })

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
    .select('transaction_id, amount, currency_type, description, created_at')
    .eq('user_id', userId)
    .eq('type', 'EARNED')
    .is('deleted_at', null)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return []
  return (data ?? []) as PointNotificationRow[]
}

/** 알림 버튼용: 최근 적립 내역만 최신순 제공 */
export async function getNotificationsForBell(
  userId: string,
  days = 7
): Promise<NotificationItem[]> {
  const earned = await getRecentPointNotifications(userId, days)
  const earnedItems: NotificationItem[] = earned.map((e) => ({ ...e, type: 'EARNED' as const }))
  const combined = [...earnedItems].sort((a, b) => {
    const aAt = a.created_at
    const bAt = b.created_at
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

/** 마이페이지용: 나에게 보낸 칭찬(단일/다중 수신자 모두, 승인된 건만). 칭찬 내용(메시지) 포함 */
export type ReceivedComplimentRow = {
  submission_id: string
  event_id: string
  event_title: string
  /** 추천·칭찬 사유: LONG(여러 줄) TEXT 우선, 없으면 SHORT·CHOICE·구형 PEER 문자열 */
  message: string
  /** PEER_SELECT JSON의 organization_name (조직형 챌린지). 없으면 null */
  organization_name: string | null
  /**
   * true: 이벤트에 여러 줄(LONG) 텍스트 항목이 있는데 비어 있고, 한 줄(SHORT) 값만 본문으로 쓴 경우.
   * (제출자가 추천 사유를 긴 칸에 안 적었을 수 있음)
   */
  short_text_only_fallback: boolean
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

  const { data: directSubs, error: directErr } = await supabase
    .from('event_submissions')
    .select('submission_id, event_id, user_id, verification_data, is_anonymous, created_at')
    .eq('peer_user_id', userId)
    .eq('status', 'APPROVED')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  const { data: multiSubs, error: multiErr } = await supabase
    .from('event_submissions')
    .select('submission_id, event_id, user_id, verification_data, is_anonymous, created_at')
    .contains('verification_data', { peer_user_ids: [userId] })
    .eq('status', 'APPROVED')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (directErr && multiErr) return []

  type ReceivedSub = {
    submission_id: string
    event_id: string
    user_id: string
    verification_data: unknown
    is_anonymous: boolean | null
    created_at: string
  }
  const mergedMap = new Map<string, ReceivedSub>()
  for (const s of directSubs ?? []) mergedMap.set(s.submission_id, s)
  for (const s of multiSubs ?? []) mergedMap.set(s.submission_id, s)
  const subs = Array.from(mergedMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)

  if (!subs.length) return []

  const eventIds = [...new Set(subs.map((s) => s.event_id))]
  const senderIds = [...new Set((subs as { user_id?: string }[]).map((s) => s.user_id).filter(Boolean))] as string[]

  const [eventsRes, usersRes, methodsRes] = await Promise.all([
    supabase.from('events').select('event_id, title').in('event_id', eventIds).is('deleted_at', null),
    senderIds.length > 0 ? supabase.from('users').select('user_id, name').in('user_id', senderIds).is('deleted_at', null) : { data: [] },
    supabase
      .from('event_verification_methods')
      .select('event_id, method_id, method_type, input_style, created_at')
      .in('event_id', eventIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
  ])

  const eventTitleBy = new Map((eventsRes.data ?? []).map((e) => [e.event_id, e.title]))
  const senderNameBy = new Map((usersRes.data ?? []).map((u) => [u.user_id, u.name ?? null]))
  /**
   * 조직형 챌린지는 TEXT가 SHORT(팀·조직명) + LONG(추천 사유)로 나뉘는 경우가 많음.
   * 전역 "가장 긴 문자열"이면 조직명만 나올 수 있어, LONG(null 포함) → SHORT → CHOICE → 구형 PEER 순으로 고름.
   */
  const peerEventIds = new Set<string>()
  const textLongByEvent = new Map<string, string[]>()
  const textShortByEvent = new Map<string, string[]>()
  const textChoiceByEvent = new Map<string, string[]>()
  const peerSelectMethodByEvent = new Map<string, string>()
  for (const m of methodsRes.data ?? []) {
    const evId = (m as { event_id: string }).event_id
    const mtype = (m as { method_type?: string }).method_type
    const mid = (m as { method_id: string }).method_id
    if (mtype === 'PEER_SELECT') {
      peerEventIds.add(evId)
      peerSelectMethodByEvent.set(evId, mid)
    }
  }
  const pushTextId = (evId: string, mid: string, inputStyle: string | null | undefined) => {
    if (inputStyle === 'SHORT') {
      const a = textShortByEvent.get(evId) ?? []
      a.push(mid)
      textShortByEvent.set(evId, a)
    } else if (inputStyle === 'CHOICE') {
      const a = textChoiceByEvent.get(evId) ?? []
      a.push(mid)
      textChoiceByEvent.set(evId, a)
    } else {
      const a = textLongByEvent.get(evId) ?? []
      a.push(mid)
      textLongByEvent.set(evId, a)
    }
  }
  for (const m of methodsRes.data ?? []) {
    const evId = (m as { event_id: string }).event_id
    if (peerEventIds.has(evId) && (m as { method_type?: string }).method_type === 'TEXT') {
      pushTextId(evId, (m as { method_id: string }).method_id, (m as { input_style?: string | null }).input_style)
    }
  }

  const longestStringInKeys = (vd: Record<string, unknown>, methodIds: string[]): string => {
    let best = ''
    for (const mid of methodIds) {
      const v = vd[mid]
      if (typeof v !== 'string') continue
      const t = v.trim()
      if (t.length > best.length) best = t
    }
    return best
  }

  const extractPeerOrgAndLegacyString = (
    vd: Record<string, unknown>,
    peerMethodId: string | undefined
  ): { organizationName: string; legacyMessage: string } => {
    if (!peerMethodId) return { organizationName: '', legacyMessage: '' }
    const raw = vd[peerMethodId]
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = (raw as { organization_name?: unknown }).organization_name
      const organizationName = typeof o === 'string' ? o.trim() : ''
      return { organizationName, legacyMessage: '' }
    }
    if (typeof raw === 'string') {
      const t = raw.trim()
      if (t && !/^[0-9a-f-]{36}$/i.test(t)) return { organizationName: '', legacyMessage: t }
    }
    return { organizationName: '', legacyMessage: '' }
  }

  const resolveComplimentBody = (
    vd: Record<string, unknown>,
    eventId: string,
    peerMethodId: string | undefined
  ): { message: string; organization_name: string | null; short_text_only_fallback: boolean } => {
    const longIds = textLongByEvent.get(eventId) ?? []
    const shortIds = textShortByEvent.get(eventId) ?? []
    const choiceIds = textChoiceByEvent.get(eventId) ?? []
    const fromLong = longestStringInKeys(vd, longIds)
    if (fromLong) {
      const { organizationName } = extractPeerOrgAndLegacyString(vd, peerMethodId)
      return {
        message: fromLong,
        organization_name: organizationName || null,
        short_text_only_fallback: false,
      }
    }
    const fromShort = longestStringInKeys(vd, shortIds)
    if (fromShort) {
      const { organizationName } = extractPeerOrgAndLegacyString(vd, peerMethodId)
      return {
        message: fromShort,
        organization_name: organizationName || null,
        short_text_only_fallback: longIds.length > 0,
      }
    }
    const fromChoice = longestStringInKeys(vd, choiceIds)
    if (fromChoice) {
      const { organizationName } = extractPeerOrgAndLegacyString(vd, peerMethodId)
      return {
        message: fromChoice,
        organization_name: organizationName || null,
        short_text_only_fallback: longIds.length > 0,
      }
    }
    const { organizationName, legacyMessage } = extractPeerOrgAndLegacyString(vd, peerMethodId)
    return {
      message: legacyMessage,
      organization_name: organizationName || null,
      short_text_only_fallback: false,
    }
  }

  return subs.map((s) => {
    const vd = (s.verification_data as Record<string, unknown>) ?? {}
    const peerMethodId = peerSelectMethodByEvent.get(s.event_id)
    const { message, organization_name, short_text_only_fallback } = resolveComplimentBody(
      vd,
      s.event_id,
      peerMethodId
    )
    const isAnonymous = s.is_anonymous ?? false
    const senderId = (s as { user_id?: string }).user_id
    const sender_name = !isAnonymous && senderId ? (senderNameBy.get(senderId) ?? null) : null
    return {
      submission_id: s.submission_id,
      event_id: s.event_id,
      event_title: eventTitleBy.get(s.event_id) ?? '칭찬 챌린지',
      message,
      organization_name,
      short_text_only_fallback,
      is_anonymous: isAnonymous,
      sender_name,
      created_at: s.created_at,
    }
  })
}
