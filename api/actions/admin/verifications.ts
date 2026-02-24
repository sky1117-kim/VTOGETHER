'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/** 이벤트별 인증 방식 (카드 렌더링용) */
export type VerificationMethodInfo = { method_id: string; method_type: string }

/** 인증 목록 한 행 (관리자용). preview_* 는 verification_data를 method_type별로 풀어서 미리보기용으로 넣은 값 */
export type PendingSubmissionRow = {
  submission_id: string
  event_id: string
  event_title: string
  round_id: string | null
  round_number: number | null
  user_id: string
  user_name: string | null
  user_email: string | null
  peer_user_id: string | null
  peer_name: string | null
  /** PENDING | APPROVED | REJECTED */
  status: string
  rejection_reason: string | null
  reviewed_at: string | null
  verification_data: Record<string, unknown> | null
  /** 이벤트의 인증 방식 목록 (카드형 표시용) */
  verification_methods: VerificationMethodInfo[]
  /** 인증 미리보기: 사진 URL (method_type=PHOTO) */
  preview_photo_url: string | null
  /** 인증 미리보기: 텍스트 (method_type=TEXT 또는 PEER_SELECT) */
  preview_text: string | null
  /** 인증 미리보기: 수치 (method_type=VALUE) */
  preview_value: string | number | null
  created_at: string
}

/** 관리자: 제출 목록 (승인대기·승인·반려) 전체 조회 (이벤트명·참여자·구간 정보 포함) */
export async function getPendingSubmissionsForAdmin(): Promise<{
  data: PendingSubmissionRow[] | null
  error: string | null
}> {
  try {
    const supabase = createAdminClient()
    const { data: submissions, error: subError } = await supabase
      .from('event_submissions')
      .select('submission_id, event_id, round_id, user_id, peer_user_id, status, rejection_reason, reviewed_at, verification_data, created_at')
      .in('status', ['PENDING', 'APPROVED', 'REJECTED'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (subError) return { data: null, error: subError.message }
    if (!submissions?.length) return { data: [], error: null }

    const eventIds = [...new Set(submissions.map((s) => s.event_id))]
    const roundIds = [...new Set(submissions.map((s) => s.round_id).filter(Boolean))] as string[]
    const userIds = [...new Set([...submissions.map((s) => s.user_id), ...submissions.map((s) => s.peer_user_id).filter(Boolean)])] as string[]

    const [eventsRes, roundsRes, usersRes, methodsRes] = await Promise.all([
      eventIds.length ? supabase.from('events').select('event_id, title').in('event_id', eventIds).is('deleted_at', null) : { data: [] },
      roundIds.length ? supabase.from('event_rounds').select('round_id, round_number').in('round_id', roundIds).is('deleted_at', null) : { data: [] },
      userIds.length ? supabase.from('users').select('user_id, name, email').in('user_id', userIds).is('deleted_at', null) : { data: [] },
      eventIds.length ? supabase.from('event_verification_methods').select('event_id, method_id, method_type').in('event_id', eventIds).is('deleted_at', null) : { data: [] },
    ])

    const eventMap = new Map((eventsRes.data ?? []).map((e) => [e.event_id, e]))
    const roundMap = new Map((roundsRes.data ?? []).map((r) => [r.round_id, r]))
    const userMap = new Map((usersRes.data ?? []).map((u) => [u.user_id, u]))
    // event_id -> [ { method_id, method_type } ]
    const methodsByEvent = new Map<string, { method_id: string; method_type: string }[]>()
    for (const m of methodsRes.data ?? []) {
      const list = methodsByEvent.get(m.event_id) ?? []
      list.push({ method_id: m.method_id, method_type: m.method_type })
      methodsByEvent.set(m.event_id, list)
    }

    const rows: PendingSubmissionRow[] = submissions.map((s) => {
      const event = eventMap.get(s.event_id)
      const round = s.round_id ? roundMap.get(s.round_id) : null
      const user = userMap.get(s.user_id)
      const peer = s.peer_user_id ? userMap.get(s.peer_user_id) : null
      const vd = (s.verification_data as Record<string, unknown>) ?? {}
      const methods = methodsByEvent.get(s.event_id) ?? []
      let preview_photo_url: string | null = null
      let preview_text: string | null = null
      let preview_value: string | number | null = null
      for (const { method_id, method_type } of methods) {
        const val = vd[method_id]
        if (val === undefined || val === null || val === '') continue
        const str = String(val).trim()
        if (method_type === 'PHOTO' && !preview_photo_url && str) preview_photo_url = str
        else if ((method_type === 'TEXT' || method_type === 'PEER_SELECT') && str) preview_text = preview_text ? `${preview_text} · ${str}` : str
        else if (method_type === 'VALUE' && (preview_value === null || preview_value === '')) preview_value = typeof val === 'number' ? val : str
      }
      return {
        submission_id: s.submission_id,
        event_id: s.event_id,
        event_title: event?.title ?? '—',
        round_id: s.round_id,
        round_number: round?.round_number ?? null,
        user_id: s.user_id,
        user_name: user?.name ?? null,
        user_email: user?.email ?? null,
        peer_user_id: s.peer_user_id,
        peer_name: peer?.name ?? null,
        status: s.status ?? 'PENDING',
        rejection_reason: s.rejection_reason ?? null,
        reviewed_at: s.reviewed_at ?? null,
        verification_data: Object.keys(vd).length ? vd : null,
        verification_methods: methods,
        preview_photo_url,
        preview_text,
        preview_value,
        created_at: s.created_at,
      }
    })

    return { data: rows, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '목록 조회 실패' }
  }
}

/** 현재 로그인 사용자 ID (관리자 심사자) */
async function getReviewerUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** 단건 승인: 포인트 지급(참여자 + 쌍방 시 수신자) 후 submission 상태 업데이트 */
export async function approveSubmission(submissionId: string): Promise<{
  success: boolean
  error: string | null
  pointsGranted?: number
}> {
  const reviewerId = await getReviewerUserId()
  if (!reviewerId) return { success: false, error: '로그인이 필요합니다.' }

  try {
    const supabase = createAdminClient()

    const { data: sub, error: subError } = await supabase
      .from('event_submissions')
      .select('submission_id, event_id, round_id, user_id, peer_user_id, status')
      .eq('submission_id', submissionId)
      .is('deleted_at', null)
      .single()

    if (subError || !sub) return { success: false, error: '제출 건을 찾을 수 없습니다.' }
    if (sub.status !== 'PENDING') return { success: false, error: '이미 심사된 건입니다.' }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, reward_policy, reward_type, reward_amount')
      .eq('event_id', sub.event_id)
      .is('deleted_at', null)
      .single()

    if (eventError || !event) return { success: false, error: '이벤트 정보를 찾을 수 없습니다.' }

    const { data: eventRewards } = await supabase
      .from('event_rewards')
      .select('reward_kind, amount')
      .eq('event_id', sub.event_id)
      .is('deleted_at', null)

    const rewards = eventRewards ?? []
    const isChoiceEvent = event.reward_type === 'CHOICE' || rewards.length > 1

    // V.Point 금액 산정: 레거시(event.reward_type) 또는 event_rewards의 V_POINT 합계. 구간제면 해당 구간 reward_amount 우선.
    let rewardAmount = 0
    if (event.reward_type != null && event.reward_type !== 'CHOICE') {
      rewardAmount = Number(event.reward_amount ?? 0)
      if (sub.round_id) {
        const { data: round } = await supabase
          .from('event_rounds')
          .select('reward_amount')
          .eq('round_id', sub.round_id)
          .is('deleted_at', null)
          .single()
        if (round?.reward_amount != null) rewardAmount = Number(round.reward_amount)
      }
    }
    if (rewardAmount === 0) {
      const pointRewards = rewards.filter((r) => r.reward_kind === 'V_POINT' && r.amount != null)
      rewardAmount = pointRewards.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
      if (sub.round_id && rewardAmount === 0) {
        const { data: round } = await supabase
          .from('event_rounds')
          .select('reward_amount')
          .eq('round_id', sub.round_id)
          .is('deleted_at', null)
          .single()
        if (round?.reward_amount != null) rewardAmount = Number(round.reward_amount)
      }
    }

    // 구간 번호(알림 메시지용)
    let roundNumber: number | null = null
    if (sub.round_id) {
      const { data: round } = await supabase
        .from('event_rounds')
        .select('round_number')
        .eq('round_id', sub.round_id)
        .is('deleted_at', null)
        .single()
      roundNumber = round?.round_number ?? null
    }

    // V.Point가 있으면(1개든 복수 보상이든) 승인 시점에 참여자(및 BOTH 시 수신자)에게 즉시 지급
    const isPoints = rewardAmount > 0
    // 단일 비포인트 보상(쿠폰/굿즈 1종): 승인 시 바로 수령 처리하여 관리자 발송 대상에 올림
    const singleNonPointReward = !isChoiceEvent && !isPoints && rewards.length === 1 ? rewards[0]!.reward_kind : null

    // 포인트 지급 대상 사용자 목록 (return 시 pointsGranted 계산에 사용하므로 블록 밖에서 선언)
    const userIdsToCredit = [sub.user_id]
    if (event.reward_policy === 'BOTH' && sub.peer_user_id) {
      userIdsToCredit.push(sub.peer_user_id)
    }

    if (isPoints) {
      for (const uid of userIdsToCredit) {
        const { data: u, error: uErr } = await supabase
          .from('users')
          .select('current_points, name, email')
          .eq('user_id', uid)
          .is('deleted_at', null)
          .single()
        if (uErr || !u) return { success: false, error: `사용자 조회 실패: ${uid}` }

        const newPoints = (u.current_points ?? 0) + rewardAmount
        const { error: updateErr } = await supabase
          .from('users')
          .update({ current_points: newPoints })
          .eq('user_id', uid)
        if (updateErr) return { success: false, error: '포인트 지급 실패' }

        const isRecipient = uid === sub.peer_user_id
        const roundDesc = roundNumber != null ? `${roundNumber}구간 승인되어` : '승인되어'
        // 칭찬 챌린지(BOTH): 제출자 vs 수신자 구분
        const description =
          event.reward_policy === 'BOTH' && sub.peer_user_id
            ? isRecipient
              ? `칭찬을 받음: 동료가 나를 칭찬하여 ${rewardAmount.toLocaleString()} P 적립`
              : `칭찬을 함: 동료를 칭찬하여 제출한 칭찬 챌린지가 승인되어 ${rewardAmount.toLocaleString()} P 적립`
            : `${event.title} ${roundDesc} ${rewardAmount.toLocaleString()} P 적립되었다`

        const { error: txErr } = await supabase.from('point_transactions').insert({
          user_id: uid,
          type: 'EARNED',
          amount: rewardAmount,
          related_id: sub.submission_id,
          related_type: 'EVENT',
          description,
          user_email: u.email ?? null,
          user_name: u.name ?? null,
        })
        if (txErr) return { success: false, error: '거래 기록 실패' }
      }
    }

    const finalRewardReceived = (isChoiceEvent && !isPoints) ? false : (isPoints || !!singleNonPointReward)
    const finalRewardType = (isChoiceEvent && !isPoints)
      ? null
      : (isPoints ? 'POINTS' : (singleNonPointReward ?? event.reward_type ?? null))
    const finalRewardAmount = (isChoiceEvent && !isPoints) ? null : (isPoints ? rewardAmount : null)

    const { error: updateSubErr } = await supabase
      .from('event_submissions')
      .update({
        status: 'APPROVED',
        reward_received: finalRewardReceived,
        reward_type: finalRewardType,
        reward_amount: finalRewardAmount,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('submission_id', submissionId)

    if (updateSubErr) return { success: false, error: updateSubErr.message }

    revalidatePath('/admin/verifications')
    revalidatePath('/admin')
    revalidatePath('/my')
    revalidatePath('/')
    return { success: true, error: null, pointsGranted: isPoints ? rewardAmount * userIdsToCredit.length : undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '승인 처리 실패' }
  }
}

/** 단건 반려 */
export async function rejectSubmission(
  submissionId: string,
  reason?: string | null
): Promise<{ success: boolean; error: string | null }> {
  const reviewerId = await getReviewerUserId()
  if (!reviewerId) return { success: false, error: '로그인이 필요합니다.' }

  try {
    const supabase = createAdminClient()
    const { data: sub } = await supabase
      .from('event_submissions')
      .select('status')
      .eq('submission_id', submissionId)
      .is('deleted_at', null)
      .single()

    if (!sub) return { success: false, error: '제출 건을 찾을 수 없습니다.' }
    if (sub.status !== 'PENDING') return { success: false, error: '이미 심사된 건입니다.' }

    const { error } = await supabase
      .from('event_submissions')
      .update({
        status: 'REJECTED',
        rejection_reason: reason?.trim() || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('submission_id', submissionId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/verifications')
    revalidatePath('/admin')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '반려 처리 실패' }
  }
}

/** 일괄 승인 */
export async function bulkApproveSubmissionIds(
  submissionIds: string[]
): Promise<{ success: boolean; processed: number; error: string | null; pointsGranted?: number }> {
  if (!submissionIds.length) return { success: true, processed: 0, error: null }
  let processed = 0
  let totalPoints = 0
  for (const id of submissionIds) {
    const result = await approveSubmission(id)
    if (result.success) {
      processed++
      if (result.pointsGranted != null) totalPoints += result.pointsGranted
    } else return { success: false, processed, error: result.error }
  }
  return { success: true, processed, error: null, pointsGranted: totalPoints > 0 ? totalPoints : undefined }
}

/** 일괄 반려 */
export async function bulkRejectSubmissionIds(
  submissionIds: string[],
  reason?: string | null
): Promise<{ success: boolean; processed: number; error: string | null }> {
  if (!submissionIds.length) return { success: true, processed: 0, error: null }
  let processed = 0
  for (const id of submissionIds) {
    const result = await rejectSubmission(id, reason)
    if (result.success) processed++
    else return { success: false, processed, error: result.error }
  }
  return { success: true, processed, error: null }
}
