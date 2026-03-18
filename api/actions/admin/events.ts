'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getThreeRoundsForMonth } from '@/lib/rounds'

export type EventRow = {
  event_id: string
  title: string
  description: string | null
  short_description: string | null
  category: 'V_TOGETHER' | 'PEOPLE'
  type: 'ALWAYS' | 'SEASONAL'
  reward_policy: 'SENDER_ONLY' | 'BOTH'
  /** 레거시 단일 보상. null이면 event_rewards 사용(복수 보상) */
  reward_type: 'V_CREDIT' | 'COUPON' | 'CHOICE' | null
  reward_amount: number | null
  image_url: string | null
  status: 'ACTIVE' | 'PAUSED' | 'ENDED'
  frequency_limit?: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** 관리자: 모든 이벤트 목록 조회 (상태 무관) */
export async function getEventsForAdmin(): Promise<{
  data: EventRow[] | null
  error: string | null
}> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) return { data: null, error: error.message }
    return { data: (data ?? []) as EventRow[], error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '이벤트 목록 조회 실패' }
  }
}

export type EventRoundRow = {
  round_id: string
  event_id: string
  round_number: number
  start_date: string
  end_date: string
  submission_deadline: string | null
  reward_amount: number | null
  created_at: string
}

export type EventRewardRow = {
  reward_id: string
  event_id: string
  reward_kind: 'V_CREDIT' | 'GOODS' | 'COFFEE_COUPON'
  amount: number | null
  display_order: number
}

export type EventVerificationMethodRow = {
  method_type: 'PHOTO' | 'TEXT' | 'VALUE' | 'PEER_SELECT'
  instruction: string | null
  label?: string | null
  input_style?: string | null
}

/** 관리자: 이벤트 단건 + 구간 + 보상 + 인증 방식 조회 */
export async function getEventWithRoundsForAdmin(eventId: string): Promise<{
  data: { event: EventRow; rounds: EventRoundRow[]; rewards: EventRewardRow[]; verification_methods: EventVerificationMethodRow[] } | null
  error: string | null
}> {
  try {
    const supabase = createAdminClient()
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .single()
    if (eventError || !event) {
      return { data: null, error: eventError?.message ?? '이벤트를 찾을 수 없습니다.' }
    }
    let rounds: EventRoundRow[] = []
    const { data: roundsData, error: roundsError } = await supabase
      .from('event_rounds')
      .select('round_id, event_id, round_number, start_date, end_date, submission_deadline, reward_amount, created_at')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('round_number', { ascending: true })
    if (!roundsError && roundsData) rounds = roundsData as EventRoundRow[]
    let rewards: EventRewardRow[] = []
    const { data: rewardsData, error: rewardsError } = await supabase
      .from('event_rewards')
      .select('reward_id, event_id, reward_kind, amount, display_order')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
    if (!rewardsError && rewardsData) rewards = rewardsData as EventRewardRow[]
    // 인증 방식: 조회만 (수정 불가). method_type, instruction, label 조회
    let verification_methods: EventVerificationMethodRow[] = []
    const { data: methodsData, error: methodsError } = await supabase
      .from('event_verification_methods')
      .select('method_type, instruction, label')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (!methodsError && methodsData) {
      verification_methods = methodsData.map((m) => ({
        method_type: m.method_type as EventVerificationMethodRow['method_type'],
        instruction: m.instruction ?? null,
        label: m.label ?? null,
      }))
    }
    return {
      data: {
        event: event as EventRow,
        rounds,
        rewards,
        verification_methods,
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '이벤트 조회 실패' }
  }
}

/** 새 이벤트 등록 시 "기존 이벤트 복사"용 — 이벤트 + 보상 + 인증 방식만 (구간 제외) */
export type EventCopySource = {
  event: Pick<
    EventRow,
    'title' | 'short_description' | 'description' | 'category' | 'type' | 'reward_policy' | 'image_url' | 'frequency_limit'
  >
  rewards: { reward_kind: 'V_CREDIT' | 'GOODS' | 'COFFEE_COUPON'; amount: number | null }[]
  verification_methods: {
    method_type: VerificationMethodInput['method_type']
    instruction: string | null
    input_style: 'SHORT' | 'LONG' | 'CHOICE' | null
    label: string | null
    unit: string | null
    options: string[] | null
  }[]
}

export async function getEventForCopy(eventId: string): Promise<{
  data: EventCopySource | null
  error: string | null
}> {
  try {
    const supabase = createAdminClient()
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, short_description, description, category, type, reward_policy, image_url, frequency_limit')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .single()
    if (eventError || !event) {
      return { data: null, error: eventError?.message ?? '이벤트를 찾을 수 없습니다.' }
    }
    const { data: rewardsData } = await supabase
      .from('event_rewards')
      .select('reward_kind, amount')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
    const rewards = (rewardsData ?? []) as EventCopySource['rewards']
    const { data: methodsData } = await supabase
      .from('event_verification_methods')
      .select('method_type, instruction, input_style, label, unit, options')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    const verification_methods = (methodsData ?? []).map((m) => ({
      method_type: m.method_type as EventCopySource['verification_methods'][0]['method_type'],
      instruction: m.instruction ?? null,
      input_style: (m.input_style === 'SHORT' || m.input_style === 'LONG' || m.input_style === 'CHOICE' ? m.input_style : null) as 'SHORT' | 'LONG' | 'CHOICE' | null,
      label: m.label ?? null,
      unit: m.unit ?? null,
      options: Array.isArray(m.options) ? m.options : (m.options ? [String(m.options)] : null),
    }))
    return {
      data: {
        event: event as EventCopySource['event'],
        rewards,
        verification_methods,
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '이벤트 복사 데이터 조회 실패' }
  }
}

export type VerificationMethodInput = {
  method_type: 'PHOTO' | 'TEXT' | 'VALUE' | 'PEER_SELECT'
  is_required?: boolean
  label?: string | null
  placeholder?: string | null
  /** 직원에게 보여줄 인증 안내 (예: 이런 이런 사진을 제출하세요) */
  instruction?: string | null
  /** 단답(SHORT)=한 줄, 장문(LONG)=여러 줄, 객관식(CHOICE)=정해진 선택지 중 선택. TEXT용 */
  input_style?: 'SHORT' | 'LONG' | 'CHOICE' | null
  /** 객관식(CHOICE)일 때만. 관리자가 정한 선택지 배열 */
  options?: string[] | null
  /** 숫자(VALUE)용. 단위 (예: km/h, km). 선택 또는 직접 입력 */
  unit?: string | null
}

/** 보상 1건. 복수 선택 가능. V_CREDIT/COFFEE_COUPON은 amount 필수, GOODS는 없음 */
export type EventRewardInput = {
  reward_kind: 'V_CREDIT' | 'GOODS' | 'COFFEE_COUPON'
  amount?: number | null
}

export type CreateEventInput = {
  title: string
  description?: string | null
  short_description?: string | null
  category: 'V_TOGETHER' | 'PEOPLE'
  type: 'ALWAYS' | 'SEASONAL'
  reward_policy: 'SENDER_ONLY' | 'BOTH'
  /** 복수 보상 (V.Credit, 굿즈, 커피쿠폰). 1개 이상 필수 */
  rewards: EventRewardInput[]
  image_url?: string | null
  status?: 'ACTIVE' | 'PAUSED' | 'ENDED'
  frequency_limit?: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | null
  verification_methods: VerificationMethodInput[]
}

/** 관리자: 이벤트 생성 (복수 보상 + 인증 방식·안내문 함께 등록) */
export async function createEvent(
  input: CreateEventInput,
  createdBy: string
): Promise<{ eventId: string | null; error: string | null }> {
  const { title, category, type, reward_policy, rewards, verification_methods } = input
  if (!title?.trim()) return { eventId: null, error: '제목을 입력하세요.' }
  if (!rewards?.length) return { eventId: null, error: '보상을 1개 이상 선택하세요.' }
  for (const r of rewards) {
    if ((r.reward_kind === 'V_CREDIT' || r.reward_kind === 'COFFEE_COUPON') && (r.amount == null || Number(r.amount) < 0))
      return { eventId: null, error: 'V.Credit·커피쿠폰은 금액(수량)을 입력하세요.' }
  }
  if (!verification_methods?.length) return { eventId: null, error: '인증 방식을 1개 이상 추가하세요.' }

  try {
    const supabase = createAdminClient()
    const frequency_limit = type === 'ALWAYS' ? (input.frequency_limit ?? 'ONCE') : null
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: title.trim(),
        description: input.description?.trim() || null,
        short_description: input.short_description?.trim() || null,
        category,
        type,
        reward_policy,
        reward_type: null,
        reward_amount: null,
        image_url: input.image_url?.trim() || null,
        status: input.status ?? 'ACTIVE',
        frequency_limit,
        created_by: createdBy,
      })
      .select('event_id')
      .single()

    if (eventError || !event) {
      return { eventId: null, error: eventError?.message ?? '이벤트 생성 실패' }
    }

    for (let i = 0; i < rewards.length; i++) {
      const r = rewards[i]
      const amount = r.reward_kind === 'GOODS' ? null : Math.max(0, Number(r.amount) ?? 0)
      const { error: rewardError } = await supabase.from('event_rewards').insert({
        event_id: event.event_id,
        reward_kind: r.reward_kind,
        amount,
        display_order: i,
      })
      if (rewardError) return { eventId: null, error: `보상 저장 실패: ${rewardError.message}` }
    }

    for (let i = 0; i < verification_methods.length; i++) {
      const m = verification_methods[i]
      const { error: methodError } = await supabase.from('event_verification_methods').insert({
        event_id: event.event_id,
        method_type: m.method_type,
        is_required: m.is_required ?? true,
        label: m.label?.trim() || null,
        placeholder: m.placeholder?.trim() || null,
        instruction: m.instruction?.trim() || null,
        input_style: m.input_style ?? null,
        options:
          m.input_style === 'CHOICE' && Array.isArray(m.options)
            ? (() => {
                const f = m.options!.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
                return f.length > 0 ? f : null
              })()
            : null,
        unit: m.method_type === 'VALUE' ? (m.unit?.trim() || null) : null,
      })
      if (methodError) {
        return { eventId: null, error: `인증 방식 저장 실패: ${methodError.message}` }
      }
    }

    revalidatePath('/admin/events')
    revalidatePath('/admin')
    revalidatePath('/')
    return { eventId: event.event_id, error: null }
  } catch (e) {
    return { eventId: null, error: e instanceof Error ? e.message : '이벤트 생성 중 오류가 발생했습니다.' }
  }
}

/** 수정 가능한 필드만. 인증/보상/구간 등 건드리면 데이터 깨질 수 있어 제외 */
export type UpdateEventSafeInput = {
  title?: string
  description?: string | null
  short_description?: string | null
  image_url?: string | null
  status?: 'ACTIVE' | 'PAUSED' | 'ENDED'
}

/** 관리자: 이벤트 소개문구·상태 등 안전한 필드만 수정 (인증/보상/구간 미변경) */
export async function updateEventSafeFields(
  eventId: string,
  input: UpdateEventSafeInput
): Promise<{ success: boolean; error: string | null }> {
  if (!eventId?.trim()) return { success: false, error: '이벤트 ID가 없습니다.' }
  if (input.title !== undefined && !input.title?.trim()) return { success: false, error: '제목을 비울 수 없습니다.' }

  try {
    const supabase = createAdminClient()
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.title !== undefined) payload.title = input.title.trim()
    if (input.description !== undefined) payload.description = input.description?.trim() || null
    if (input.short_description !== undefined) payload.short_description = input.short_description?.trim() || null
    if (input.image_url !== undefined) payload.image_url = input.image_url?.trim() || null
    if (input.status !== undefined) payload.status = input.status

    const { error } = await supabase.from('events').update(payload).eq('event_id', eventId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/events')
    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath('/admin')
    revalidatePath('/')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '수정 중 오류가 발생했습니다.' }
  }
}

/** 보상 금액 수정 1건 (V_CREDIT, COFFEE_COUPON만. GOODS는 금액 없음) */
export type UpdateEventRewardAmountInput = { reward_id: string; amount: number }

/** 관리자: 이벤트 보상 금액만 수정 (이미 지급된 건 기존 금액 유지, 이후 인증 통과분부터 새 금액 적용) */
export async function updateEventRewardAmounts(
  eventId: string,
  updates: UpdateEventRewardAmountInput[]
): Promise<{ success: boolean; error: string | null }> {
  if (!eventId?.trim()) return { success: false, error: '이벤트 ID가 없습니다.' }
  for (const u of updates) {
    if (u.amount < 0) return { success: false, error: '보상 금액은 0 이상이어야 합니다.' }
  }

  try {
    const supabase = createAdminClient()
    for (const u of updates) {
      const { error } = await supabase
        .from('event_rewards')
        .update({ amount: u.amount })
        .eq('reward_id', u.reward_id)
        .eq('event_id', eventId)
      if (error) return { success: false, error: `보상 금액 수정 실패: ${error.message}` }
    }
    revalidatePath('/admin/events')
    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath('/admin')
    revalidatePath('/')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '보상 금액 수정 중 오류가 발생했습니다.' }
  }
}

/** 관리자: 이벤트 소프트 삭제 (deleted_at 플래그로 관리, 관련 데이터 함께 플래그) */
export async function deleteEvent(eventId: string): Promise<{ success: boolean; error: string | null }> {
  if (!eventId?.trim()) return { success: false, error: '이벤트 ID가 없습니다.' }
  try {
    const supabase = createAdminClient()
    const now = new Date().toISOString()
    // 관련 테이블 순서대로 soft delete (자식 → 부모)
    await supabase.from('event_submissions').update({ deleted_at: now }).eq('event_id', eventId)
    await supabase.from('event_rounds').update({ deleted_at: now }).eq('event_id', eventId)
    await supabase.from('event_rewards').update({ deleted_at: now }).eq('event_id', eventId)
    await supabase.from('event_verification_methods').update({ deleted_at: now }).eq('event_id', eventId)
    const { error } = await supabase.from('events').update({ deleted_at: now }).eq('event_id', eventId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/events')
    revalidatePath('/admin')
    revalidatePath('/')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '이벤트 삭제 중 오류가 발생했습니다.' }
  }
}

/**
 * 기간제 이벤트에 해당 월 3구간 자동 생성 (plan-rounds-logic.md)
 * 1구간 1~10일(인증 15일), 2구간 11~20일(인증 25일), 3구간 21~말일(인증 익월 5일)
 */
export async function createRoundsForMonth(
  eventId: string,
  year: number,
  month: number
): Promise<{ success: boolean; error: string | null }> {
  if (month < 1 || month > 12) return { success: false, error: '월은 1~12 사이여야 합니다.' }
  try {
    const supabase = createAdminClient()
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('type')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .single()
    if (eventError || !event) return { success: false, error: '이벤트를 찾을 수 없습니다.' }
    if (event.type !== 'SEASONAL') return { success: false, error: '기간제(SEASONAL) 이벤트만 구간을 추가할 수 있습니다.' }

    const { data: existing } = await supabase
      .from('event_rounds')
      .select('round_number')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('round_number', { ascending: false })
      .limit(1)
    const nextNumber = existing?.[0]?.round_number != null ? existing[0].round_number + 1 : 1

    const ranges = getThreeRoundsForMonth(year, month)
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i]
      const { error: insertErr } = await supabase.from('event_rounds').insert({
        event_id: eventId,
        round_number: nextNumber + i,
        start_date: r.start_date,
        end_date: r.end_date,
        submission_deadline: r.submission_deadline,
      })
      if (insertErr) return { success: false, error: `구간 저장 실패: ${insertErr.message}` }
    }

    revalidatePath('/admin/events')
    revalidatePath('/admin')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '구간 생성 중 오류가 발생했습니다.' }
  }
}

/** 관리자: 구간 1건 소프트 삭제 (deleted_at 플래그로 관리) */
export async function deleteEventRound(
  eventId: string,
  roundId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!eventId?.trim() || !roundId?.trim()) return { success: false, error: '이벤트/구간 ID가 없습니다.' }
  try {
    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const { error: submissionsError } = await supabase
      .from('event_submissions')
      .update({ deleted_at: now })
      .eq('round_id', roundId)
    if (submissionsError) return { success: false, error: `제출 이력 삭제 실패: ${submissionsError.message}` }
    const { error: roundError } = await supabase
      .from('event_rounds')
      .update({ deleted_at: now })
      .eq('round_id', roundId)
      .eq('event_id', eventId)
    if (roundError) return { success: false, error: `구간 삭제 실패: ${roundError.message}` }
    revalidatePath('/admin/events')
    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath('/admin')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '구간 삭제 중 오류가 발생했습니다.' }
  }
}

/** 엑셀 다운로드용: 특정 이벤트의 제출 목록 (관리자 전용) */
export type EventSubmissionExportRow = {
  이벤트명: string
  구간: string
  참여자명: string
  이메일: string
  상태: string
  제출일시: string
  보상유형: string
  반려사유: string
  인증요약: string
}

export async function getEventSubmissionsForExport(eventId: string): Promise<{
  data: EventSubmissionExportRow[] | null
  eventTitle: string | null
  error: string | null
}> {
  if (!eventId?.trim()) return { data: null, eventTitle: null, error: '이벤트 ID가 없습니다.' }
  try {
    const supabase = createAdminClient()
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('title')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .single()
    if (eventErr || !event) return { data: null, eventTitle: null, error: eventErr?.message ?? '이벤트를 찾을 수 없습니다.' }

    const { data: submissions, error: subErr } = await supabase
      .from('event_submissions')
      .select('submission_id, event_id, round_id, user_id, peer_user_id, status, reward_type, rejection_reason, verification_data, created_at')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (subErr) return { data: null, eventTitle: event.title, error: subErr.message }
    if (!submissions?.length) return { data: [], eventTitle: event.title, error: null }

    const roundIds = [...new Set(submissions.map((s) => s.round_id).filter(Boolean))] as string[]
    const userIds = [...new Set([...submissions.map((s) => s.user_id), ...submissions.map((s) => s.peer_user_id).filter(Boolean)])] as string[]

    const [roundsRes, usersRes, methodsRes] = await Promise.all([
      roundIds.length ? supabase.from('event_rounds').select('round_id, round_number').in('round_id', roundIds).is('deleted_at', null) : { data: [] },
      userIds.length ? supabase.from('users').select('user_id, name, email').in('user_id', userIds).is('deleted_at', null) : { data: [] },
      supabase.from('event_verification_methods').select('event_id, method_id, method_type').eq('event_id', eventId).is('deleted_at', null),
    ])

    const roundMap = new Map((roundsRes.data ?? []).map((r) => [r.round_id, r]))
    const userMap = new Map((usersRes.data ?? []).map((u) => [u.user_id, u]))
    const methods = (methodsRes.data ?? []) as { method_id: string; method_type: string }[]

    const STATUS_LABEL: Record<string, string> = { PENDING: '승인대기', APPROVED: '승인', REJECTED: '반려' }
    const REWARD_LABEL: Record<string, string> = { V_CREDIT: 'V.Credit', POINTS: 'V.Credit', COFFEE_COUPON: '커피쿠폰', GOODS: '굿즈', COUPON: '쿠폰' }

    const data: EventSubmissionExportRow[] = submissions.map((s) => {
      const round = s.round_id ? roundMap.get(s.round_id) : null
      const user = userMap.get(s.user_id)
      const peer = s.peer_user_id ? userMap.get(s.peer_user_id) : null
      const vd = (s.verification_data as Record<string, unknown>) ?? {}
      const parts: string[] = []
      for (const { method_id, method_type } of methods) {
        const val = vd[method_id]
        if (val === undefined || val === null || val === '') continue
        if (method_type === 'PHOTO') {
          const count = Array.isArray(val) ? (val as string[]).length : 1
          parts.push(count > 1 ? `사진 ${count}장` : '사진')
        }
        else if (method_type === 'TEXT') parts.push(String(val).slice(0, 80))
        else if (method_type === 'PEER_SELECT') parts.push(peer?.name ?? '동료 선택됨')
        else if (method_type === 'VALUE') parts.push(String(val))
      }
      return {
        이벤트명: event.title,
        구간: round ? `${round.round_number}구간` : '상시',
        참여자명: user?.name ?? user?.email ?? s.user_id,
        이메일: user?.email ?? s.user_id,
        상태: STATUS_LABEL[s.status] ?? s.status,
        제출일시: new Date(s.created_at).toLocaleString('ko-KR'),
        보상유형: s.reward_type ? (REWARD_LABEL[s.reward_type] ?? s.reward_type) : '—',
        반려사유: s.rejection_reason ?? '',
        인증요약: parts.join(' / ') || '—',
      }
    })

    return { data, eventTitle: event.title, error: null }
  } catch (e) {
    return { data: null, eventTitle: null, error: e instanceof Error ? e.message : '내보내기 실패' }
  }
}
