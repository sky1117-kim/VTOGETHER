'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getEventForParticipation } from '@/api/queries/events'

const REWARD_KIND_LABEL: Record<string, string> = {
  V_CREDIT: 'V.Credit',
  V_MEDAL: 'V.Medal',
  COFFEE_COUPON: '커피 쿠폰',
  GOODS: '굿즈',
}

/** 인증 사진 업로드 → Storage에 저장 후 공개 URL 반환. bucket 'event-verification' 필요 */
export async function uploadEventVerificationPhoto(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const file = formData.get('file') as File | null
  if (!file?.size) return { url: null, error: '파일을 선택하세요.' }
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) return { url: null, error: '파일은 5MB 이하여야 합니다.' }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) return { url: null, error: '이미지 파일만 업로드할 수 있습니다.' }

  try {
    const supabase = createAdminClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `verification/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('event-verification').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) return { url: null, error: error.message }
    const { data: urlData } = supabase.storage.from('event-verification').getPublicUrl(data.path)
    return { url: urlData.publicUrl, error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : '업로드 실패' }
  }
}

/** 이벤트 대표 이미지 업로드 → Storage에 저장 후 공개 URL 반환. bucket 'event-verification' 내 representative/ 경로 사용 */
export async function uploadEventRepresentativeImage(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const file = formData.get('file') as File | null
  if (!file?.size) return { url: null, error: '파일을 선택하세요.' }
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) return { url: null, error: '파일은 5MB 이하여야 합니다.' }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) return { url: null, error: '이미지 파일만 업로드할 수 있습니다.' }

  try {
    const supabase = createAdminClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `representative/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('event-verification').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) return { url: null, error: error.message }
    const { data: urlData } = supabase.storage.from('event-verification').getPublicUrl(data.path)
    return { url: urlData.publicUrl, error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : '업로드 실패' }
  }
}

/** 모달용: 이벤트 + 인증 방식 + 구간(현재 로그인 사용자 기준 상태 포함). 인증 방식이 비어 있으면 admin으로 한 번 더 조회 */
export async function getEventForParticipationAction(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const result = await getEventForParticipation(eventId, user?.id ?? null)
  if (result.data && result.data.verificationMethods.length === 0) {
    const admin = createAdminClient()
    const { data: methods } = await admin
      .from('event_verification_methods')
      .select('method_id, method_type, instruction, label, placeholder, input_style, unit, options')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (methods?.length) {
      result.data.verificationMethods = methods as typeof result.data.verificationMethods
    }
  }
  return result
}

/** ALWAYS 이벤트: 제출 전 빈도 제한 검사 */
async function checkAlwaysFrequency(eventId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { canParticipateNow } = await import('@/api/queries/event-status')
  const result = await canParticipateNow(eventId, userId)
  if (result.allowed) return { ok: true }
  return { ok: false, error: result.reason ?? '참여할 수 없습니다.' }
}

/**
 * 로그인한 사용자가 이벤트 인증 제출 (메인 페이지 모달에서 호출).
 * ALWAYS 이벤트는 빈도 제한(일/주/월 1회) 검사 후 제출.
 * 칭찬 챌린지(PEER_SELECT)일 때 peerUserId로 선택한 동료 전달.
 * isAnonymous true면 칭찬 수신자에게는 익명으로 표시, 관리자는 제출자 확인 가능.
 */
export async function submitEventSubmission(
  eventId: string,
  roundId: string | null,
  verificationData: Record<string, unknown>,
  peerUserId?: string | null,
  isAnonymous?: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { success: false, error: '로그인이 필요합니다.' }

    const userId = user.id

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('event_id, type, status')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .single()
    if (eventErr || !event) return { success: false, error: '이벤트를 찾을 수 없습니다.' }
    if (event.status !== 'ACTIVE') return { success: false, error: '진행 중인 이벤트가 아닙니다.' }

    if (event.type === 'SEASONAL' && !roundId) {
      return { success: false, error: '기간제 이벤트는 구간을 선택하세요.' }
    }
    if (event.type === 'ALWAYS') {
      roundId = null
      const freq = await checkAlwaysFrequency(eventId, userId)
      if (!freq.ok) return { success: false, error: freq.error ?? null }
    }

    // 필수 인증 항목(사진·텍스트 등)이 모두 채워졌는지 서버에서 검증
    const { data: methods } = await supabase
      .from('event_verification_methods')
      .select('method_id, method_type')
      .eq('event_id', eventId)
      .is('deleted_at', null)
    const methodList = methods ?? []
    const hasPeerSelect = methodList.some((r) => (r as { method_type?: string }).method_type === 'PEER_SELECT')
    if (hasPeerSelect && (!peerUserId || !String(peerUserId).trim())) {
      return { success: false, error: '칭찬할 동료를 선택해주세요.' }
    }
    const requiredMethods = methodList as { method_id: string; method_type: string }[]
    for (const m of requiredMethods) {
      const val = verificationData[m.method_id]
      if (m.method_type === 'PHOTO') {
        const urls = Array.isArray(val) ? val.filter((u): u is string => typeof u === 'string' && !!u.trim()) : []
        if (urls.length < 2) {
          return { success: false, error: '사진을 2장 이상 제출해주세요.' }
        }
      } else if (val === undefined || val === null || String(val).trim() === '') {
        return { success: false, error: '필수 인증 항목(사진·텍스트 등)을 모두 입력해주세요.' }
      }
    }

    const { error: insertErr } = await supabase.from('event_submissions').insert({
      event_id: eventId,
      round_id: roundId,
      user_id: userId,
      status: 'PENDING',
      verification_data: verificationData,
      peer_user_id: peerUserId && peerUserId.trim() ? peerUserId.trim() : null,
      is_anonymous: hasPeerSelect && !!isAnonymous,
    })
    if (insertErr) {
      if (insertErr.code === '23505') return { success: false, error: '이미 해당 구간에 제출했습니다.' }
      return { success: false, error: insertErr.message }
    }

    revalidatePath('/')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '제출 중 오류가 발생했습니다.' }
  }
}

type RewardKindChoice = 'V_CREDIT' | 'V_MEDAL' | 'COFFEE_COUPON' | 'GOODS'

/**
 * 승인 후 보상 선택(CHOICE/복수 보상): 사용자가 보상 종류를 골라 포인트 지급 또는 쿠폰/굿즈 선택
 */
export async function claimRewardChoice(
  submissionId: string,
  rewardKind: RewardKindChoice
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { success: false, error: '로그인이 필요합니다.' }

    const { data: sub, error: subErr } = await supabase
      .from('event_submissions')
      .select('submission_id, event_id, round_id, user_id, peer_user_id, is_anonymous, status, reward_received')
      .eq('submission_id', submissionId)
      .is('deleted_at', null)
      .single()

    if (subErr || !sub) return { success: false, error: '제출 건을 찾을 수 없습니다.' }
    if (sub.user_id !== user.id) return { success: false, error: '본인 제출만 선택할 수 있습니다.' }
    if (sub.status !== 'APPROVED') return { success: false, error: '승인된 건만 보상을 선택할 수 있습니다.' }
    if (sub.reward_received) return { success: false, error: '이미 보상을 선택했습니다.' }

    const { data: rewards } = await supabase
      .from('event_rewards')
      .select('reward_kind, amount')
      .eq('event_id', sub.event_id)
      .is('deleted_at', null)
    const option = (rewards ?? []).find((r) => r.reward_kind === rewardKind)
    if (!option) return { success: false, error: `선택할 수 없는 보상입니다: ${REWARD_KIND_LABEL[rewardKind] ?? rewardKind}` }

    const admin = createAdminClient()
    const { data: event } = await admin.from('events').select('title, reward_policy').eq('event_id', sub.event_id).is('deleted_at', null).single()

    let rewardAmount = 0
    let roundNumber: number | null = null
    if ((rewardKind === 'V_CREDIT' || rewardKind === 'V_MEDAL') && option.amount != null) {
      rewardAmount = Number(option.amount)
      if (sub.round_id) {
        const { data: round } = await admin.from('event_rounds').select('reward_amount, round_number').eq('round_id', sub.round_id).is('deleted_at', null).single()
        if (round?.reward_amount != null) rewardAmount = round.reward_amount
        roundNumber = round?.round_number ?? null
      }
    }

    if ((rewardKind === 'V_CREDIT' || rewardKind === 'V_MEDAL') && rewardAmount > 0) {
      const userIdsToCredit = [sub.user_id]
      if (event?.reward_policy === 'BOTH' && sub.peer_user_id) userIdsToCredit.push(sub.peer_user_id)
      const eventTitle = event?.title ?? '이벤트'
      const roundDesc = roundNumber != null ? `${roundNumber}구간 승인되어` : '승인되어'

      // 사용자 정보 1회 조회 (칭찬 챌린지 시 2명일 수 있음)
      const { data: usersData, error: usersErr } = await admin
        .from('users')
        .select('user_id, current_points, current_medals, name, email')
        .in('user_id', userIdsToCredit)
        .is('deleted_at', null)
      if (usersErr || !usersData || usersData.length !== userIdsToCredit.length) {
        return { success: false, error: '사용자 조회 실패' }
      }
      const userMap = new Map(usersData.map((u) => [u.user_id, u]))

      for (const uid of userIdsToCredit) {
        const u = userMap.get(uid)
        if (!u) return { success: false, error: '사용자 조회 실패' }
        if (rewardKind === 'V_MEDAL') {
          await admin.from('users').update({ current_medals: (u.current_medals ?? 0) + rewardAmount }).eq('user_id', uid)
        } else {
          await admin.from('users').update({ current_points: (u.current_points ?? 0) + rewardAmount }).eq('user_id', uid)
          await admin.from('credit_lots').insert({
            user_id: uid,
            source_type: 'ACTIVITY',
            initial_amount: rewardAmount,
            remaining_amount: rewardAmount,
            related_id: sub.submission_id,
            description: `${eventTitle} 이벤트 보상`,
          })
        }
        const isRecipient = uid === sub.peer_user_id
        const anonymousFromRecipient = sub.is_anonymous && isRecipient
        const unitLabel = rewardKind === 'V_MEDAL' ? 'M' : 'C'
        const description =
          event?.reward_policy === 'BOTH' && sub.peer_user_id
            ? isRecipient
              ? `칭찬을 받음: ${anonymousFromRecipient ? '익명의 동료가' : '동료가'} 나를 칭찬하여 ${rewardAmount.toLocaleString()} ${unitLabel} 적립`
              : `칭찬을 함: 동료를 칭찬하여 제출한 칭찬 챌린지가 승인되어 ${rewardAmount.toLocaleString()} ${unitLabel} 적립`
            : `${eventTitle} ${roundDesc} ${rewardAmount.toLocaleString()} ${unitLabel} 적립`
        await admin.from('point_transactions').insert({
          user_id: uid,
          type: 'EARNED',
          amount: rewardAmount,
          currency_type: rewardKind,
          related_id: sub.submission_id,
          related_type: 'EVENT',
          description,
          user_email: u.email ?? null,
          user_name: u.name ?? null,
        })
      }
    }

    const { error: updateErr } = await admin
      .from('event_submissions')
      .update({
        reward_received: true,
        reward_type: rewardKind,
        reward_amount: rewardKind === 'V_CREDIT' || rewardKind === 'V_MEDAL' ? rewardAmount : null,
      })
      .eq('submission_id', submissionId)

    if (updateErr) return { success: false, error: updateErr.message }
    revalidatePath('/')
    revalidatePath('/my')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '보상 선택 처리에 실패했습니다.' }
  }
}
