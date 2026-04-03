'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { collectPeerUserIdsOrdered } from '@/lib/peer-select-display'

/** 이벤트별 인증 방식 (카드/테이블 렌더링용). label·unit은 심사 시 "거리: 34 km" 등 표시에 사용 */
export type VerificationMethodInfo = {
  method_id: string
  method_type: string
  label?: string | null
  unit?: string | null
}

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
  /** true면 칭찬 수신자에게는 익명 표시, 관리자는 제출자 이름 확인 가능 */
  is_anonymous: boolean
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
  /** 동료 선택(PEER_SELECT) 수신자 해석용 — 관리자 목록 조회 시 채움 */
  peer_recipients?: Array<{
    user_id: string
    name: string | null
    email: string | null
    dept_name: string | null
  }>
}

function getRecipientUserIds(sub: {
  peer_user_id: string | null
  verification_data?: unknown
}): string[] {
  const fromSingle = sub.peer_user_id ? [sub.peer_user_id] : []
  const vd = (sub.verification_data ?? {}) as Record<string, unknown>
  const fromArray = Array.isArray(vd.peer_user_ids)
    ? vd.peer_user_ids.map((v) => String(v).trim()).filter(Boolean)
    : []
  const fromNested: string[] = []
  for (const v of Object.values(vd)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = (v as { peer_user_ids?: unknown }).peer_user_ids
      if (Array.isArray(nested)) {
        for (const x of nested) {
          const s = typeof x === 'string' ? x.trim() : ''
          if (s) fromNested.push(s)
        }
      }
    }
  }
  return [...new Set([...fromSingle, ...fromArray, ...fromNested])]
}

/** 관리자: 제출 목록 (승인대기·승인·반려) 전체 조회 (이벤트명·참여자·구간 정보 포함) */
export async function getPendingSubmissionsForAdmin(): Promise<{
  data: PendingSubmissionRow[] | null
  error: string | null
}> {
  const auth = await requireAdminReviewer()
  if (!auth.ok) return { data: null, error: auth.error }
  try {
    const supabase = createAdminClient()
    const { data: submissions, error: subError } = await supabase
      .from('event_submissions')
      .select('submission_id, event_id, round_id, user_id, peer_user_id, is_anonymous, status, rejection_reason, reviewed_at, verification_data, created_at')
      .in('status', ['PENDING', 'APPROVED', 'REJECTED'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (subError) return { data: null, error: subError.message }
    if (!submissions?.length) return { data: [], error: null }

    const eventIds = [...new Set(submissions.map((s) => s.event_id))]
    const roundIds = [...new Set(submissions.map((s) => s.round_id).filter(Boolean))] as string[]
    const methodsByEvent = new Map<string, VerificationMethodInfo[]>()
    const { data: methodsRows } =
      eventIds.length > 0
        ? await supabase
            .from('event_verification_methods')
            .select('event_id, method_id, method_type, label, unit')
            .in('event_id', eventIds)
            .is('deleted_at', null)
            .order('event_id')
            .order('created_at', { ascending: true })
        : { data: [] }
    for (const m of methodsRows ?? []) {
      const list = methodsByEvent.get(m.event_id) ?? []
      list.push({
        method_id: m.method_id,
        method_type: m.method_type,
        label: m.label ?? null,
        unit: m.unit ?? null,
      })
      methodsByEvent.set(m.event_id, list)
    }

    const extraPeerIds = new Set<string>()
    for (const s of submissions) {
      const vd = (s.verification_data as Record<string, unknown>) ?? {}
      const methods = methodsByEvent.get(s.event_id) ?? []
      for (const id of collectPeerUserIdsOrdered(vd, methods)) {
        extraPeerIds.add(id)
      }
      for (const id of getRecipientUserIds({
        peer_user_id: s.peer_user_id,
        verification_data: s.verification_data,
      })) {
        extraPeerIds.add(id)
      }
    }

    const userIds = [
      ...new Set([
        ...submissions.map((s) => s.user_id),
        ...submissions.map((s) => s.peer_user_id).filter(Boolean),
        ...extraPeerIds,
      ]),
    ] as string[]

    const [eventsRes, roundsRes, usersRes] = await Promise.all([
      eventIds.length ? supabase.from('events').select('event_id, title').in('event_id', eventIds).is('deleted_at', null) : { data: [] },
      roundIds.length ? supabase.from('event_rounds').select('round_id, round_number').in('round_id', roundIds).is('deleted_at', null) : { data: [] },
      userIds.length
        ? supabase.from('users').select('user_id, name, email, dept_name').in('user_id', userIds).is('deleted_at', null)
        : { data: [] },
    ])

    const eventMap = new Map((eventsRes.data ?? []).map((e) => [e.event_id, e]))
    const roundMap = new Map((roundsRes.data ?? []).map((r) => [r.round_id, r]))
    const userMap = new Map((usersRes.data ?? []).map((u) => [u.user_id, u]))

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
        if (val === undefined || val === null) continue
        if (method_type === 'PHOTO' && !preview_photo_url) {
          const firstUrl = Array.isArray(val) ? (val[0] as string) : String(val).trim()
          if (firstUrl) preview_photo_url = firstUrl
        } else {
          const str = Array.isArray(val) ? (val as string[]).join(', ') : String(val).trim()
          if (str === '') continue
          if (method_type === 'TEXT' && str) preview_text = preview_text ? `${preview_text} · ${str}` : str
          else if (method_type === 'PEER_SELECT' && str) {
            const orderedIds = collectPeerUserIdsOrdered(vd, methods)
            const names = orderedIds.map((id) => userMap.get(id)?.name?.trim()).filter(Boolean) as string[]
            let peerPreview = peer?.name ?? '동료 선택됨'
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              const obj = val as { organization_name?: unknown; peer_user_ids?: unknown }
              const org = typeof obj.organization_name === 'string' ? obj.organization_name.trim() : ''
              const peerIds = Array.isArray(obj.peer_user_ids)
                ? obj.peer_user_ids.filter((x): x is string => typeof x === 'string' && !!x.trim())
                : []
              if (peerIds.length > 1) {
                peerPreview =
                  names.length > 0
                    ? org
                      ? `${org} · ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` 외 ${names.length - 3}명` : ''}`
                      : `${names[0]} 외 ${peerIds.length - 1}명`
                    : `${peerPreview} 외 ${peerIds.length - 1}명`
              }
              if (org && peerIds.length <= 1) peerPreview = `${org} · ${peerPreview}`
            }
            preview_text = preview_text ? `${preview_text} · ${peerPreview}` : peerPreview
          }
          else if (method_type === 'VALUE' && (preview_value === null || preview_value === '')) preview_value = typeof val === 'number' ? val : str
        }
      }
      const orderedPeerIds = collectPeerUserIdsOrdered(vd, methods)
      const peer_recipients =
        orderedPeerIds.length > 0
          ? orderedPeerIds.map((id) => {
              const u = userMap.get(id)
              return {
                user_id: id,
                name: u?.name ?? null,
                email: u?.email ?? null,
                dept_name: u?.dept_name ?? null,
              }
            })
          : undefined

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
        is_anonymous: s.is_anonymous ?? false,
        status: s.status ?? 'PENDING',
        rejection_reason: s.rejection_reason ?? null,
        reviewed_at: s.reviewed_at ?? null,
        verification_data: Object.keys(vd).length ? vd : null,
        verification_methods: methods,
        preview_photo_url,
        preview_text,
        preview_value,
        created_at: s.created_at,
        peer_recipients,
      }
    })

    return { data: rows, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '목록 조회 실패' }
  }
}

/** 현재 로그인 사용자가 관리자인지 확인하고 심사자 ID 반환 */
async function requireAdminReviewer(): Promise<{ ok: true; reviewerId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data: me, error } = await admin
    .from('users')
    .select('is_admin')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !me?.is_admin) return { ok: false, error: '관리자만 사용할 수 있습니다.' }
  return { ok: true, reviewerId: user.id }
}

/** 단건 승인: 포인트 지급(참여자 + 쌍방 시 수신자) 후 submission 상태 업데이트 */
export async function approveSubmission(submissionId: string): Promise<{
  success: boolean
  error: string | null
  pointsGranted?: number
}> {
  const auth = await requireAdminReviewer()
  if (!auth.ok) return { success: false, error: auth.error }
  const reviewerId = auth.reviewerId

  try {
    const supabase = createAdminClient()

    const { data: sub, error: subError } = await supabase
      .from('event_submissions')
      .select('submission_id, event_id, round_id, user_id, peer_user_id, verification_data, is_anonymous, status')
      .eq('submission_id', submissionId)
      .is('deleted_at', null)
      .single()

    if (subError || !sub) return { success: false, error: '제출 건을 찾을 수 없습니다.' }
    if (sub.status !== 'PENDING') return { success: false, error: '이미 심사된 건입니다.' }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, category, reward_policy, reward_type, reward_amount')
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

    // 구간 정보 1회 조회 (reward_amount, round_number 모두 사용)
    let roundRewardAmount: number | null = null
    let roundNumber: number | null = null
    if (sub.round_id) {
      const { data: round } = await supabase
        .from('event_rounds')
        .select('reward_amount, round_number')
        .eq('round_id', sub.round_id)
        .is('deleted_at', null)
        .single()
      roundRewardAmount = round?.reward_amount ?? null
      roundNumber = round?.round_number ?? null
    }

    // 이벤트 카테고리 정책: People=V.Medal, Culture=V.Credit
    const primaryCurrency = event.category === 'PEOPLE' ? 'V_MEDAL' : 'V_CREDIT'
    let rewardAmount = 0
    if (event.reward_type != null && event.reward_type !== 'CHOICE') {
      rewardAmount = Number(event.reward_amount ?? 0)
      if (roundRewardAmount != null) rewardAmount = Number(roundRewardAmount)
    }
    if (rewardAmount === 0) {
      const currencyRewards = rewards.filter((r) => r.reward_kind === primaryCurrency && r.amount != null)
      rewardAmount = currencyRewards.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
      if (roundRewardAmount != null && rewardAmount === 0) rewardAmount = Number(roundRewardAmount)
    }

    // 복수 보상/CHOICE: 사용자가 선택하므로 승인 시점에 지급하지 않음
    // 단일 보상만: 정책 재화 즉시 지급 또는 쿠폰/굿즈 수령 처리
    const isCurrencyReward = rewardAmount > 0
    // 단일 비포인트 보상(쿠폰/굿즈 1종): 승인 시 바로 수령 처리하여 관리자 발송 대상에 올림
    const singleNonPointReward = !isChoiceEvent && !isCurrencyReward && rewards.length === 1 ? rewards[0]!.reward_kind : null

    // 포인트 지급 대상 사용자 목록 (return 시 pointsGranted 계산에 사용하므로 블록 밖에서 선언)
    const userIdsToCredit = [sub.user_id]
    const recipientUserIds = getRecipientUserIds(sub)
    if (event.reward_policy === 'BOTH' && recipientUserIds.length > 0) {
      userIdsToCredit.push(...recipientUserIds)
    }
    const uniqueUserIdsToCredit = [...new Set(userIdsToCredit)]

    // isChoiceEvent면 사용자 선택 대기 → 포인트 지급 안 함. 단일 보상만 즉시 지급
    if (isCurrencyReward && !isChoiceEvent) {
      for (const uid of uniqueUserIdsToCredit) {
        const { data: u, error: uErr } = await supabase
          .from('users')
          .select('current_points, current_medals, name, email')
          .eq('user_id', uid)
          .is('deleted_at', null)
          .single()
        if (uErr || !u) return { success: false, error: `사용자 조회 실패: ${uid}` }

        const updatePayload =
          primaryCurrency === 'V_MEDAL'
            ? { current_medals: (u.current_medals ?? 0) + rewardAmount }
            : { current_points: (u.current_points ?? 0) + rewardAmount }
        const { error: updateErr } = await supabase.from('users').update(updatePayload).eq('user_id', uid)
        if (updateErr) return { success: false, error: '포인트 지급 실패' }

        if (primaryCurrency === 'V_CREDIT') {
          await supabase.from('credit_lots').insert({
            user_id: uid,
            source_type: 'ACTIVITY',
            initial_amount: rewardAmount,
            remaining_amount: rewardAmount,
            related_id: sub.submission_id,
            description: `${event.title} 이벤트 보상`,
          })
        }

        const isRecipient = recipientUserIds.includes(uid)
        const roundDesc = roundNumber != null ? `${roundNumber}구간 승인되어` : '승인되어'
        const unitLabel = primaryCurrency === 'V_MEDAL' ? 'M' : 'C'
        const description =
          event.reward_policy === 'BOTH' && recipientUserIds.length > 0
            ? isRecipient
              ? `칭찬챌린지 (수신): ${rewardAmount.toLocaleString()} ${unitLabel} 적립`
              : `칭찬챌린지 (발신): ${rewardAmount.toLocaleString()} ${unitLabel} 적립`
            : `${event.title} ${roundDesc} ${rewardAmount.toLocaleString()} ${unitLabel} 적립`

        const { error: txErr } = await supabase.from('point_transactions').insert({
          user_id: uid,
          type: 'EARNED',
          amount: rewardAmount,
          currency_type: primaryCurrency,
          related_id: sub.submission_id,
          related_type: 'EVENT',
          description,
          user_email: u.email ?? null,
          user_name: u.name ?? null,
        })
        if (txErr) return { success: false, error: '거래 기록 실패' }
      }
    }

    // 복수 보상(CHOICE)이면 사용자 선택 대기 → reward_received는 항상 false
    const finalRewardReceived = isChoiceEvent ? false : (isCurrencyReward || !!singleNonPointReward)
    const finalRewardType = isChoiceEvent
      ? null
      : (isCurrencyReward ? primaryCurrency : (singleNonPointReward ?? event.reward_type ?? null))
    const finalRewardAmount = (isChoiceEvent && !isCurrencyReward) ? null : (isCurrencyReward ? rewardAmount : null)

    const { data: updatedSub, error: updateSubErr } = await supabase
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
      .eq('status', 'PENDING')
      .select('submission_id')
      .maybeSingle()

    if (updateSubErr) return { success: false, error: updateSubErr.message }
    if (!updatedSub) return { success: false, error: '이미 심사된 건입니다.' }

    revalidatePath('/admin/verifications')
    revalidatePath('/admin')
    revalidatePath('/my')
    revalidatePath('/')
    return { success: true, error: null, pointsGranted: (isCurrencyReward && !isChoiceEvent) ? rewardAmount * uniqueUserIdsToCredit.length : undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '승인 처리 실패' }
  }
}

/** 단건 반려 */
export async function rejectSubmission(
  submissionId: string,
  reason?: string | null
): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdminReviewer()
  if (!auth.ok) return { success: false, error: auth.error }
  const reviewerId = auth.reviewerId

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

    const { data: updatedSub, error } = await supabase
      .from('event_submissions')
      .update({
        status: 'REJECTED',
        rejection_reason: reason?.trim() || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('submission_id', submissionId)
      .eq('status', 'PENDING')
      .select('submission_id')
      .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!updatedSub) return { success: false, error: '이미 심사된 건입니다.' }
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
