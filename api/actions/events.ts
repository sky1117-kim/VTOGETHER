'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getEventForParticipation } from '@/api/queries/events'
import { sendGoogleChatAdminAlert } from '@/lib/google-chat-alert'
import { parseChoiceOptions } from '@/lib/verification-choice-options'
import { detectImageExtension, detectImageOrPdfExtension } from '@/lib/validate-image-upload'

function isMultiPeerSelectMode(method: { options?: unknown }): boolean {
  return Array.isArray(method.options) && method.options.includes('MULTIPLE')
}

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
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
  if (error || !me?.is_admin) return { ok: false, error: '관리자 권한이 필요합니다.' }
  return { ok: true, userId: user.id }
}

/** 인증 사진 업로드 → Storage에 저장 후 공개 URL 반환. bucket 'event-verification' 필요 (로그인 사용자 전용) */
export async function uploadEventVerificationPhoto(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const authClient = await createClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) return { url: null, error: '로그인이 필요합니다.' }

  const file = formData.get('file') as File | null
  if (!file?.size) return { url: null, error: '파일을 선택하세요.' }
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) return { url: null, error: '파일은 5MB 이하여야 합니다.' }
  const detected = await detectImageExtension(file)
  if (detected.error) return { url: null, error: detected.error }

  try {
    const supabase = createAdminClient()
    const path = `verification/${Date.now()}-${randomUUID()}.${detected.ext}`
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

/** 건강 챌린지 참가 기준표(PDF·이미지) 업로드 → health-criteria/ 경로 (관리자 전용) */
export async function uploadHealthCriteriaAttachment(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { url: null, error: auth.error }

  const file = formData.get('file') as File | null
  if (!file?.size) return { url: null, error: '파일을 선택하세요.' }
  const maxSize = 15 * 1024 * 1024
  if (file.size > maxSize) return { url: null, error: '파일은 15MB 이하여야 합니다.' }
  const detected = await detectImageOrPdfExtension(file)
  if (detected.error) return { url: null, error: detected.error }

  try {
    const supabase = createAdminClient()
    const path = `health-criteria/${Date.now()}-${randomUUID()}.${detected.ext}`
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

/** 이벤트 대표 이미지 업로드 → Storage에 저장 후 공개 URL 반환. bucket 'event-verification' 내 representative/ 경로 사용 (관리자 전용) */
export async function uploadEventRepresentativeImage(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { url: null, error: auth.error }

  const file = formData.get('file') as File | null
  if (!file?.size) return { url: null, error: '파일을 선택하세요.' }
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) return { url: null, error: '파일은 5MB 이하여야 합니다.' }
  const detected = await detectImageExtension(file)
  if (detected.error) return { url: null, error: detected.error }

  try {
    const supabase = createAdminClient()
    const path = `representative/${Date.now()}-${randomUUID()}.${detected.ext}`
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
  isAnonymous?: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { success: false, error: '로그인이 필요합니다.' }

    const userId = user.id

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('event_id, title, type, status')
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
      .select('method_id, method_type, input_style, options')
      .eq('event_id', eventId)
      .is('deleted_at', null)
    const methodList = methods ?? []
    const hasPeerSelect = methodList.some((r) => (r as { method_type?: string }).method_type === 'PEER_SELECT')
    // 4.1.2 프로세스 검증누락 조치: 클라이언트가 보낸 peer_user_ids를 신뢰하지 않고
    // 아래 검증 루프를 통과한 값만 이 배열에 채워 최종 저장에 사용합니다.
    const validatedPeerUserIds: string[] = []
    const requiredMethods = methodList as {
      method_id: string
      method_type: string
      input_style?: string | null
      options?: unknown
    }[]
    for (const m of requiredMethods) {
      const val = verificationData[m.method_id]
      if (m.method_type === 'PHOTO') {
        const urls = Array.isArray(val) ? val.filter((u): u is string => typeof u === 'string' && !!u.trim()) : []
        if (urls.length < 1) {
          return { success: false, error: '사진을 1장 이상 제출해주세요.' }
        }
      } else if (m.method_type === 'PEER_SELECT') {
        let peerIds: string[] = []
        let organizationName: string | null = null
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const obj = val as { peer_user_ids?: unknown; organization_name?: unknown }
          peerIds = Array.isArray(obj.peer_user_ids)
            ? obj.peer_user_ids.filter((x): x is string => typeof x === 'string' && !!x.trim())
            : []
          organizationName =
            typeof obj.organization_name === 'string' && obj.organization_name.trim()
              ? obj.organization_name.trim()
              : null
        } else if (Array.isArray(val)) {
          peerIds = val.filter((x): x is string => typeof x === 'string' && !!x.trim())
        } else if (typeof val === 'string' && val.trim()) {
          peerIds = [val.trim()]
        }
        peerIds = [...new Set(peerIds)]
        if (peerIds.length === 0) {
          return { success: false, error: '칭찬할 동료를 1명 이상 선택해주세요.' }
        }
        const isMultiMode = isMultiPeerSelectMode(m)
        if (!isMultiMode && peerIds.length > 1) {
          return { success: false, error: '개인형 칭찬 챌린지는 동료 1명만 선택할 수 있습니다.' }
        }
        // 본인을 칭찬 대상에 포함하는 '셀프 보상' 차단
        if (peerIds.includes(userId)) {
          return { success: false, error: '본인을 칭찬 대상으로 선택할 수 없습니다.' }
        }
        // 실제 존재하는 사용자인지, (조직형인 경우) 신청한 조직 소속이 맞는지 서버에서 재대조
        const { data: verifiedPeers, error: peerLookupErr } = await supabase
          .from('users')
          .select('user_id, dept_name')
          .in('user_id', peerIds)
          .is('deleted_at', null)
        if (peerLookupErr) {
          return { success: false, error: '대상자 확인 중 오류가 발생했습니다.' }
        }
        const deptByUserId = new Map((verifiedPeers ?? []).map((u) => [u.user_id, u.dept_name]))
        if (deptByUserId.size !== peerIds.length) {
          return { success: false, error: '선택한 대상 중 존재하지 않는 사용자가 있습니다.' }
        }
        if (organizationName && peerIds.some((id) => deptByUserId.get(id) !== organizationName)) {
          return { success: false, error: '선택한 대상 중 실제 소속 조직과 일치하지 않는 인원이 있습니다.' }
        }
        validatedPeerUserIds.push(...peerIds)
      } else if (val === undefined || val === null || String(val).trim() === '') {
        return { success: false, error: '필수 인증 항목(사진·텍스트 등)을 모두 입력해주세요.' }
      } else if (m.method_type === 'TEXT' && m.input_style === 'CHOICE') {
        const allowed = parseChoiceOptions(m.options)
        const picked = String(val).trim()
        if (allowed.length < 2) {
          return { success: false, error: '객관식 인증 설정이 올바르지 않습니다. 관리자에게 문의해주세요.' }
        }
        if (!allowed.includes(picked)) {
          return { success: false, error: '선택한 답이 유효하지 않습니다. 다시 선택해주세요.' }
        }
      }
    }

    const finalPeerUserIds = [...new Set(validatedPeerUserIds)]
    const payloadVerificationData =
      hasPeerSelect && finalPeerUserIds.length > 0
        ? { ...verificationData, peer_user_ids: finalPeerUserIds }
        : verificationData

    const insertRow = {
      event_id: eventId,
      round_id: roundId,
      user_id: userId,
      status: 'PENDING' as const,
      verification_data: payloadVerificationData,
      peer_user_id: finalPeerUserIds[0] ?? null,
      is_anonymous: hasPeerSelect && !!isAnonymous,
    }

    const sendSubmitAdminAlert = async () => {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.NEXT_PUBLIC_DEV_APP_URL?.trim() ||
        'http://localhost:3000'
      const adminVerificationLink = `${appUrl.replace(/\/+$/, '')}/admin/verifications`
      await sendGoogleChatAdminAlert({
        title: '새 인증 제출(승인 대기)',
        userEmail: user.email ?? undefined,
        userName:
          (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
          (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
          undefined,
        message: [
          `이벤트: ${event.title ?? '이벤트명 없음'}`,
          `확인 링크: ${adminVerificationLink}`,
        ].join('\n'),
      })
    }

    const { error: insertErr } = await supabase.from('event_submissions').insert(insertRow)

    if (!insertErr) {
      await sendSubmitAdminAlert()
      revalidatePath('/')
      return { success: true, error: null }
    }

    // DB에 020 유니크만 적용된 경우: 반려 행이 남아 있으면 INSERT가 23505로 막힘.
    // RLS상 사용자는 UPDATE 불가이므로, 본인·REJECTED·해당 구간만 관리자 클라이언트로 갱신합니다.
    if (insertErr.code === '23505') {
      const admin = createAdminClient()
      let rejectedQ = admin
        .from('event_submissions')
        .select('submission_id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .eq('status', 'REJECTED')
        .is('deleted_at', null)
      rejectedQ = roundId === null ? rejectedQ.is('round_id', null) : rejectedQ.eq('round_id', roundId)
      const { data: rejectedRow, error: rejFetchErr } = await rejectedQ
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (rejFetchErr || !rejectedRow?.submission_id) {
        return { success: false, error: '이미 해당 구간에 제출했습니다.' }
      }

      const { data: updated, error: upErr } = await admin
        .from('event_submissions')
        .update({
          status: 'PENDING',
          verification_data: payloadVerificationData,
          peer_user_id: finalPeerUserIds[0] ?? null,
          is_anonymous: hasPeerSelect && !!isAnonymous,
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
        })
        .eq('submission_id', rejectedRow.submission_id)
        .eq('user_id', userId)
        .eq('status', 'REJECTED')
        .select('submission_id')
        .maybeSingle()

      if (upErr) return { success: false, error: upErr.message }
      if (!updated) return { success: false, error: '이미 해당 구간에 제출했습니다.' }

      await sendSubmitAdminAlert()
      revalidatePath('/')
      return { success: true, error: null }
    }

    return { success: false, error: insertErr.message }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '제출 중 오류가 발생했습니다.' }
  }
}

/**
 * 보상 선택 기능은 정책 종료되었습니다.
 * 모든 보상은 승인 시점에 자동으로 지급됩니다.
 */
export async function claimRewardChoice(): Promise<{ success: boolean; error: string | null }> {
  return { success: false, error: '보상 선택 기능이 종료되었습니다. 승인 시 자동 지급됩니다.' }
}
