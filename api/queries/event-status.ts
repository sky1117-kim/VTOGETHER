/**
 * 이벤트 구간별 상태 및 ALWAYS 빈도 체크 (plan-events-operations.md)
 * SEASONAL: LOCKED/OPEN/SUBMITTED/APPROVED/DONE/FAILED
 * ALWAYS: canParticipateNow(eventId, userId)
 */

import { createClient } from '@/lib/supabase/server'

/** SEASONAL 구간 단위 사용자 상태 */
export type RoundParticipantStatus =
  | 'LOCKED'   // 구간 미오픈
  | 'OPEN'     // 참여 가능
  | 'SUBMITTED' // 승인 대기중
  | 'APPROVED'  // 보상 받기/선택 대기
  | 'DONE'     // 보상 수령 완료
  | 'FAILED'   // 기회 마감(미제출)
  | 'REJECTED'  // 반려됨 (사용자에게 표시)

export type FrequencyLimit = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | null

interface SubmissionRow {
  submission_id: string
  round_id: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reward_received: boolean
}

/**
 * 구간 + 제출 정보로 상태 계산 (plan-events-operations.md §2.3, plan-rounds-logic.md)
 * 인증 마감은 submission_deadline이 있으면 그 시각, 없으면 end_date 사용.
 */
export function getRoundStatus(
  round: { start_date: string; end_date: string; submission_deadline?: string | null },
  submission: { status: string; reward_received: boolean } | null,
  now: Date = new Date()
): RoundParticipantStatus {
  const start = new Date(round.start_date)
  const end = new Date(round.end_date)
  const deadline = round.submission_deadline ? new Date(round.submission_deadline) : end

  if (now < start) return 'LOCKED'

  if (submission) {
    if (submission.status === 'PENDING') return 'SUBMITTED'
    if (submission.status === 'REJECTED') return 'REJECTED'
    if (submission.status === 'APPROVED') {
      if (submission.reward_received) return 'DONE'
      return 'APPROVED'
    }
  }

  if (now > deadline) return 'FAILED'
  return 'OPEN'
}

/** SEASONAL 이벤트: 구간 목록 + 사용자별 제출 + 구간별 상태 반환 */
export async function getRoundsWithStatusForUser(
  eventId: string,
  userId: string
): Promise<{
  rounds: Array<{
    round_id: string
    round_number: number
    start_date: string
    end_date: string
    reward_amount: number | null
    status: RoundParticipantStatus
    submission_id: string | null
    submission_status: string | null
    reward_received: boolean | null
  }>
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const now = new Date()

    const { data: rounds, error: roundsError } = await supabase
      .from('event_rounds')
      .select('round_id, event_id, round_number, start_date, end_date, submission_deadline, reward_amount')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('round_number', { ascending: true })

    if (roundsError || !rounds?.length) {
      return { rounds: [], error: roundsError?.message ?? null }
    }

    const roundIds = rounds.map((r) => r.round_id)
    const { data: submissions } = await supabase
      .from('event_submissions')
      .select('submission_id, round_id, status, reward_received')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .in('round_id', roundIds)
      .is('deleted_at', null)

    const submissionByRound = new Map<string | null, SubmissionRow>()
    for (const s of submissions ?? []) {
      submissionByRound.set(s.round_id, s as SubmissionRow)
    }

    const result = rounds.map((r) => {
      const sub = submissionByRound.get(r.round_id) ?? null
      const status = getRoundStatus(
        {
          start_date: r.start_date,
          end_date: r.end_date,
          submission_deadline: r.submission_deadline ?? null,
        },
        sub,
        now
      )
      return {
        round_id: r.round_id,
        round_number: r.round_number,
        start_date: r.start_date,
        end_date: r.end_date,
        submission_deadline: r.submission_deadline ?? null,
        reward_amount: r.reward_amount,
        status,
        submission_id: sub?.submission_id ?? null,
        submission_status: sub?.status ?? null,
        reward_received: sub?.reward_received ?? null,
      }
    })

    return { rounds: result, error: null }
  } catch (e) {
    return { rounds: [], error: e instanceof Error ? e.message : '구간 목록 조회 실패' }
  }
}

/** ALWAYS 이벤트: 해당 사용자의 가장 최근 제출 1건 (round_id IS NULL) */
export async function getLastSubmissionForAlwaysEvent(
  eventId: string,
  userId: string
): Promise<{ submission_id: string; created_at: string } | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_submissions')
    .select('submission_id, created_at')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .is('round_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

/** 같은 날(UTC 0시 기준) 여부 */
function isSameDayUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

/** 같은 주(UTC, 월~일) 여부 */
function isSameWeekUTC(a: Date, b: Date): boolean {
  const getWeek = (d: Date) => {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay()))
    return start.getTime()
  }
  return getWeek(a) === getWeek(b)
}

/** 같은 달(UTC) 여부 */
function isSameMonthUTC(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
}

/** ALWAYS 이벤트 여러 개의 참여 가능 여부를 1회 쿼리로 일괄 조회 */
export async function canParticipateNowBatch(
  events: { event_id: string; frequency_limit: string | null }[],
  userId: string
): Promise<Map<string, { allowed: boolean; reason?: string; nextAvailableAt?: string }>> {
  const result = new Map<string, { allowed: boolean; reason?: string; nextAvailableAt?: string }>()
  if (events.length === 0) return result

  const eventIds = events.map((e) => e.event_id)
  const supabase = await createClient()
  const now = new Date()

  const { data: subs } = await supabase
    .from('event_submissions')
    .select('event_id, created_at')
    .eq('user_id', userId)
    .in('event_id', eventIds)
    .is('round_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // 이벤트별 가장 최근 제출 1건
  const lastByEvent = new Map<string, { created_at: string }>()
  for (const s of subs ?? []) {
    if (!lastByEvent.has(s.event_id)) lastByEvent.set(s.event_id, { created_at: s.created_at })
  }

  for (const ev of events) {
    const frequency = (ev.frequency_limit ?? 'ONCE') as FrequencyLimit
    const last = lastByEvent.get(ev.event_id)
    if (!last) {
      result.set(ev.event_id, { allowed: true })
      continue
    }
    const lastAt = new Date(last.created_at)
    switch (frequency) {
      case 'ONCE':
        result.set(ev.event_id, { allowed: false, reason: '이미 참여한 이벤트입니다.' })
        break
      case 'DAILY':
        if (isSameDayUTC(now, lastAt)) {
          const next = new Date(lastAt)
          next.setUTCDate(next.getUTCDate() + 1)
          next.setUTCHours(0, 0, 0, 0)
          result.set(ev.event_id, { allowed: false, reason: '오늘 이미 참여했습니다.', nextAvailableAt: next.toISOString() })
        } else {
          result.set(ev.event_id, { allowed: true })
        }
        break
      case 'WEEKLY':
        result.set(ev.event_id, isSameWeekUTC(now, lastAt)
          ? { allowed: false, reason: '이번 주 이미 참여했습니다.' }
          : { allowed: true })
        break
      case 'MONTHLY':
        result.set(ev.event_id, isSameMonthUTC(now, lastAt)
          ? { allowed: false, reason: '이번 달 이미 참여했습니다.' }
          : { allowed: true })
        break
      default:
        result.set(ev.event_id, { allowed: true })
    }
  }
  return result
}

/**
 * ALWAYS 이벤트: 지금 참여 가능한지 (빈도 제한 체크)
 * SEASONAL이면 true (구간별 로직은 getRoundsWithStatusForUser 사용)
 */
export async function canParticipateNow(
  eventId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string; nextAvailableAt?: string }> {
  const supabase = await createClient()
  const now = new Date()

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('type, frequency_limit')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .single()

  if (eventError || !event) {
    return { allowed: false, reason: '이벤트를 찾을 수 없습니다.' }
  }

  if (event.type !== 'ALWAYS') {
    return { allowed: true }
  }

  const last = await getLastSubmissionForAlwaysEvent(eventId, userId)
  const frequency = (event.frequency_limit ?? 'ONCE') as FrequencyLimit

  if (!last) {
    return { allowed: true }
  }

  const lastAt = new Date(last.created_at)

  switch (frequency) {
    case 'ONCE':
      return { allowed: false, reason: '이미 참여한 이벤트입니다.' }
    case 'DAILY':
      if (isSameDayUTC(now, lastAt)) {
        const next = new Date(lastAt)
        next.setUTCDate(next.getUTCDate() + 1)
        next.setUTCHours(0, 0, 0, 0)
        return { allowed: false, reason: '오늘 이미 참여했습니다.', nextAvailableAt: next.toISOString() }
      }
      return { allowed: true }
    case 'WEEKLY':
      if (isSameWeekUTC(now, lastAt)) {
        return { allowed: false, reason: '이번 주 이미 참여했습니다.' }
      }
      return { allowed: true }
    case 'MONTHLY':
      if (isSameMonthUTC(now, lastAt)) {
        return { allowed: false, reason: '이번 달 이미 참여했습니다.' }
      }
      return { allowed: true }
    default:
      return { allowed: true }
  }
}
