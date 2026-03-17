import { createClient } from '@/lib/supabase/server'

export type PublicEventRow = {
  event_id: string
  title: string
  description: string | null
  short_description: string | null
  image_url: string | null
  category: 'V_TOGETHER' | 'CULTURE'
  type: 'ALWAYS' | 'SEASONAL'
  [key: string]: unknown
}

/** 메인/이벤트 페이지: ACTIVE 상태 이벤트만 조회 + 구간 수(rounds_count) */
export async function getEventsForPublic(): Promise<
  (PublicEventRow & { rounds_count: number })[]
> {
  const supabase = await createClient()
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'ACTIVE')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) return []
  const list = (events ?? []) as PublicEventRow[]
  if (list.length === 0) return []

  const eventIds = list.map((e) => e.event_id)
  const { data: rounds } = await supabase
    .from('event_rounds')
    .select('event_id')
    .in('event_id', eventIds)
    .is('deleted_at', null)
  const countByEvent = new Map<string, number>()
  for (const r of rounds ?? []) {
    countByEvent.set(r.event_id, (countByEvent.get(r.event_id) ?? 0) + 1)
  }
  return list.map((e) => ({
    ...e,
    rounds_count: countByEvent.get(e.event_id) ?? 0,
  }))
}

/** 메인 카드용: 구간별 상태(오픈/마감 등). userId 있으면 제출 여부 반영 */
export type RoundStatusLabel = {
  round_id: string
  round_number: number
  status: 'LOCKED' | 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'DONE' | 'FAILED' | 'REJECTED'
}

/** ALWAYS 이벤트 카드용: 참여 가능 여부 (빈도 제한 체크 결과) */
export type AlwaysParticipationStatus = {
  allowed: boolean
  reason?: string
  nextAvailableAt?: string
}

export type PublicEventWithRounds = PublicEventRow & {
  rounds_count: number
  rounds: RoundStatusLabel[]
  /** 승인됐으나 보상 미수령(보상 선택 대기). 카드에서 "보상받기" 버튼 노출용 */
  hasPendingReward?: boolean
  /** ALWAYS 이벤트일 때만: 빈도 제한 체크 결과 (카드 태그용) */
  alwaysParticipation?: AlwaysParticipationStatus
}

export async function getEventsWithRoundsForPublic(
  userId?: string | null
): Promise<PublicEventWithRounds[]> {
  const base = await getEventsForPublic()
  const seasonal = base.filter((e) => e.type === 'SEASONAL' && (e.rounds_count ?? 0) > 0)
  if (seasonal.length === 0) {
    return base.map((e) => ({ ...e, rounds: [] }))
  }

  const supabase = await createClient()
  const eventIds = seasonal.map((e) => e.event_id)
  const { data: roundsRows } = await supabase
    .from('event_rounds')
    .select('round_id, event_id, round_number, start_date, end_date, submission_deadline')
    .in('event_id', eventIds)
    .is('deleted_at', null)
    .order('round_number', { ascending: true })
  const roundsByEvent = new Map<string, typeof roundsRows>()
  for (const r of roundsRows ?? []) {
    const list = roundsByEvent.get(r.event_id) ?? []
    list.push(r)
    roundsByEvent.set(r.event_id, list)
  }

  let submissionsByRound = new Map<string, { status: string; reward_received: boolean }>()
  if (userId) {
    const roundIds = (roundsRows ?? []).map((r) => r.round_id)
    if (roundIds.length > 0) {
      const { data: subs } = await supabase
        .from('event_submissions')
        .select('round_id, status, reward_received')
        .eq('user_id', userId)
        .in('round_id', roundIds)
        .is('deleted_at', null)
      for (const s of subs ?? []) {
        submissionsByRound.set(s.round_id, {
          status: s.status,
          reward_received: s.reward_received ?? false,
        })
      }
    }
  }

  const { getRoundStatus } = await import('./event-status')
  const now = new Date()

  const eventRoundsMap = new Map<string, RoundStatusLabel[]>()
  for (const [eid, rounds] of roundsByEvent) {
    const list: RoundStatusLabel[] = (rounds ?? []).map((r) => {
      const sub = submissionsByRound.get(r.round_id) ?? null
      const status = getRoundStatus(
        {
          start_date: r.start_date,
          end_date: r.end_date,
          submission_deadline: r.submission_deadline ?? null,
        },
        sub,
        now
      )
      return { round_id: r.round_id, round_number: r.round_number, status }
    })
    eventRoundsMap.set(eid, list)
  }

  // ALWAYS 이벤트: 승인·보상 미수령 건 있는지 조회 (보상받기 버튼용) + 참여 가능 여부 (빈도 제한, 카드 태그용)
  let alwaysPendingRewardByEvent = new Map<string, boolean>()
  const alwaysParticipationByEvent = new Map<string, AlwaysParticipationStatus>()
  if (userId) {
    const alwaysEvents = base.filter((e) => e.type === 'ALWAYS')
    if (alwaysEvents.length > 0) {
      const { data: alwaysSubs } = await supabase
        .from('event_submissions')
        .select('event_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .eq('status', 'APPROVED')
        .eq('reward_received', false)
        .is('round_id', null)
      for (const s of alwaysSubs ?? []) {
        alwaysPendingRewardByEvent.set(s.event_id, true)
      }
      const { canParticipateNowBatch } = await import('./event-status')
      const batchResult = await canParticipateNowBatch(
        alwaysEvents.map((ev) => ({
          event_id: ev.event_id,
          frequency_limit: typeof ev.frequency_limit === 'string' ? ev.frequency_limit : null,
        })),
        userId
      )
      for (const [eid, res] of batchResult) alwaysParticipationByEvent.set(eid, res)
    }
  }

  return base.map((e) => {
    const rounds = eventRoundsMap.get(e.event_id) ?? []
    const hasPendingRewardSeasonal = e.type === 'SEASONAL' && rounds.some((r) => r.status === 'APPROVED')
    const hasPendingRewardAlways = e.type === 'ALWAYS' && alwaysPendingRewardByEvent.get(e.event_id)
    const alwaysParticipation = e.type === 'ALWAYS' ? alwaysParticipationByEvent.get(e.event_id) : undefined
    return {
      ...e,
      rounds,
      hasPendingReward: hasPendingRewardSeasonal || hasPendingRewardAlways || false,
      alwaysParticipation,
    }
  })
}

/** 모달용: 이벤트 한 건 + 인증 방식 + 구간(기간제일 때). 로그인 사용자면 구간별 상태 포함 */
export type VerificationMethodRow = {
  method_id: string
  method_type: string
  instruction: string | null
  label: string | null
  placeholder: string | null
  input_style?: 'SHORT' | 'LONG' | null
  /** 숫자(VALUE)용. 단위 (예: km/h, km) */
  unit?: string | null
}

export type RoundForParticipation = {
  round_id: string
  round_number: number
  start_date: string
  end_date: string
  submission_deadline: string | null
  status?: 'LOCKED' | 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'DONE' | 'FAILED' | 'REJECTED'
}

/** 보상 선택용 옵션 (CHOICE/복수 보상) */
export type RewardOptionRow = {
  reward_kind: 'V_POINT' | 'COFFEE_COUPON' | 'GOODS'
  amount: number | null
}

/** 보상 선택 대기 제출 1건 (승인됐으나 아직 보상 미선택) */
export type PendingChoiceSubmission = {
  submission_id: string
  round_number: number | null
}

/** 동료 선택(PEER_SELECT)용 플랫폼 가입자 한 명 */
export type PeerSelectionUserRow = {
  user_id: string
  name: string | null
  email: string | null
  dept_name: string | null
}

export async function getEventForParticipation(
  eventId: string,
  userId?: string | null
): Promise<{
  data: {
    event: { event_id: string; title: string; type: string }
    verificationMethods: VerificationMethodRow[]
    rounds: RoundForParticipation[]
    rewardOptions: RewardOptionRow[]
    pendingChoiceSubmission: PendingChoiceSubmission | null
    canParticipate?: { allowed: boolean; reason?: string; nextAvailableAt?: string }
    /** PEER_SELECT 인증 방식이 있을 때만: 플랫폼 가입자 전체 목록 */
    peerSelectionUsers?: PeerSelectionUserRow[]
    /** 로그인 사용자 ID (동료 선택에서 본인 제외용) */
    currentUserId?: string | null
  } | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('event_id, title, type, reward_type')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .eq('status', 'ACTIVE')
    .single()
  if (eventErr || !event) return { data: null, error: eventErr?.message ?? '이벤트를 찾을 수 없습니다.' }

  const { data: methods } = await supabase
    .from('event_verification_methods')
    .select('method_id, method_type, instruction, label, placeholder, input_style, unit')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  const verificationMethods = (methods ?? []) as VerificationMethodRow[]

  const hasPeerSelect = verificationMethods.some((m) => m.method_type === 'PEER_SELECT')
  let peerSelectionUsers: PeerSelectionUserRow[] | undefined
  if (hasPeerSelect) {
    const { data: users } = await supabase
      .from('users')
      .select('user_id, name, email, dept_name')
      .is('deleted_at', null)
      .order('name', { ascending: true, nullsFirst: false })
    peerSelectionUsers = (users ?? []).map((u) => ({
      user_id: u.user_id,
      name: u.name ?? null,
      email: u.email ?? null,
      dept_name: u.dept_name ?? null,
    }))
  }

  const { data: eventRewards } = await supabase
    .from('event_rewards')
    .select('reward_kind, amount')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('reward_kind')
  const rewardOptions: RewardOptionRow[] = (eventRewards ?? []).map((r) => ({
    reward_kind: r.reward_kind as RewardOptionRow['reward_kind'],
    amount: r.amount != null ? Number(r.amount) : null,
  }))
  // 보상 선택 필요: CHOICE 타입이거나 복수 보상. 단, reward_received=false인 제출이 있으면 무조건 조회 (이벤트 수정 등으로 옵션이 바뀌었을 수 있음)
  const needsRewardChoice = event.reward_type === 'CHOICE' || rewardOptions.length > 1

  let pendingChoiceSubmission: PendingChoiceSubmission | null = null
  if (userId && rewardOptions.length > 0) {
    const { data: pending } = await supabase
      .from('event_submissions')
      .select('submission_id, round_id')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .eq('user_id', userId)
      .eq('status', 'APPROVED')
      .eq('reward_received', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pending) {
      let round_number: number | null = null
      if (pending.round_id) {
        const { data: round } = await supabase
          .from('event_rounds')
          .select('round_number')
          .eq('round_id', pending.round_id)
          .is('deleted_at', null)
          .single()
        round_number = round?.round_number ?? null
      }
      pendingChoiceSubmission = { submission_id: pending.submission_id, round_number }
    }
  }

  let rounds: RoundForParticipation[] = []
  if (event.type === 'SEASONAL') {
    const { data: roundsData } = await supabase
      .from('event_rounds')
      .select('round_id, round_number, start_date, end_date, submission_deadline')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('round_number', { ascending: true })
    rounds = (roundsData ?? []).map((r) => ({
      ...r,
      submission_deadline: r.submission_deadline ?? null,
    })) as RoundForParticipation[]

    if (userId) {
      const { getRoundsWithStatusForUser } = await import('./event-status')
      const { rounds: withStatus } = await getRoundsWithStatusForUser(eventId, userId)
      const statusByRound = new Map(withStatus.map((r) => [r.round_id, r.status]))
      rounds = rounds.map((r) => ({ ...r, status: statusByRound.get(r.round_id) }))
    }
  }

  let canParticipate: { allowed: boolean; reason?: string; nextAvailableAt?: string } | undefined
  if (userId && event.type === 'ALWAYS') {
    const { canParticipateNow } = await import('./event-status')
    canParticipate = await canParticipateNow(eventId, userId)
  }

  return {
    data: {
      event: event as { event_id: string; title: string; type: string },
      verificationMethods,
      rounds,
      rewardOptions,
      pendingChoiceSubmission,
      canParticipate,
      peerSelectionUsers,
      currentUserId: userId ?? null,
    },
    error: null,
  }
}
