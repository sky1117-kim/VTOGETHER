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
    .order('created_at', { ascending: false })
  if (error) return []
  const list = (events ?? []) as PublicEventRow[]
  if (list.length === 0) return []

  const eventIds = list.map((e) => e.event_id)
  const { data: rounds } = await supabase
    .from('event_rounds')
    .select('event_id')
    .in('event_id', eventIds)
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

export type PublicEventWithRounds = PublicEventRow & {
  rounds_count: number
  rounds: RoundStatusLabel[]
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
    const { data: subs } = await supabase
      .from('event_submissions')
      .select('round_id, status, reward_received')
      .eq('user_id', userId)
      .in('round_id', roundIds)
    for (const s of subs ?? []) {
      submissionsByRound.set(s.round_id, {
        status: s.status,
        reward_received: s.reward_received ?? false,
      })
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

  return base.map((e) => ({
    ...e,
    rounds: eventRoundsMap.get(e.event_id) ?? [],
  }))
}

/** 모달용: 이벤트 한 건 + 인증 방식 + 구간(기간제일 때). 로그인 사용자면 구간별 상태 포함 */
export type VerificationMethodRow = {
  method_id: string
  method_type: string
  instruction: string | null
  label: string | null
  placeholder: string | null
  input_style?: 'SHORT' | 'LONG' | null
}

export type RoundForParticipation = {
  round_id: string
  round_number: number
  start_date: string
  end_date: string
  submission_deadline: string | null
  status?: 'LOCKED' | 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'DONE' | 'FAILED'
}

export async function getEventForParticipation(
  eventId: string,
  userId?: string | null
): Promise<{
  data: {
    event: { event_id: string; title: string; type: string }
    verificationMethods: VerificationMethodRow[]
    rounds: RoundForParticipation[]
  } | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('event_id, title, type')
    .eq('event_id', eventId)
    .eq('status', 'ACTIVE')
    .single()
  if (eventErr || !event) return { data: null, error: eventErr?.message ?? '이벤트를 찾을 수 없습니다.' }

  const { data: methods } = await supabase
    .from('event_verification_methods')
    .select('method_id, method_type, instruction, label, placeholder, input_style')
    .eq('event_id', eventId)
    .order('method_id')
  const verificationMethods = (methods ?? []) as VerificationMethodRow[]

  let rounds: RoundForParticipation[] = []
  if (event.type === 'SEASONAL') {
    const { data: roundsData } = await supabase
      .from('event_rounds')
      .select('round_id, round_number, start_date, end_date, submission_deadline')
      .eq('event_id', eventId)
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

  return {
    data: { event: event as { event_id: string; title: string; type: string }, verificationMethods, rounds },
    error: null,
  }
}
