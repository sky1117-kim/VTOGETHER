import { createClient } from '@/lib/supabase/server'

export async function getUserData(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
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
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data
}

export async function getUserPointTransactions(userId: string, limit = 20) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', userId)
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
    .order('created_at', { ascending: false })
    .limit(limit)

  if (subsError || !subs?.length) return []

  const eventIds = [...new Set(subs.map((s) => s.event_id))]
  const { data: events } = await supabase
    .from('events')
    .select('event_id, title')
    .in('event_id', eventIds)
  const eventTitleBy = new Map((events ?? []).map((e) => [e.event_id, e.title]))

  const roundIds = subs.map((s) => s.round_id).filter(Boolean) as string[]
  let roundNumberBy = new Map<string, number>()
  if (roundIds.length > 0) {
    const { data: rounds } = await supabase
      .from('event_rounds')
      .select('round_id, round_number')
      .in('round_id', roundIds)
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
