'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getEventForParticipation } from '@/api/queries/events'
import { sendGoogleChatAdminAlert } from '@/lib/google-chat-alert'

function isMultiPeerSelectMode(method: { options?: string[] | null }): boolean {
  return Array.isArray(method.options) && method.options.includes('MULTIPLE')
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

/** 건강 챌린지 참가 기준표(PDF·이미지) 업로드 → health-criteria/ 경로 */
export async function uploadHealthCriteriaAttachment(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const file = formData.get('file') as File | null
  if (!file?.size) return { url: null, error: '파일을 선택하세요.' }
  const maxSize = 15 * 1024 * 1024
  if (file.size > maxSize) return { url: null, error: '파일은 15MB 이하여야 합니다.' }
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ]
  if (!allowed.includes(file.type)) {
    return { url: null, error: 'PDF 또는 이미지(jpg, png, webp, gif)만 업로드할 수 있습니다.' }
  }

  try {
    const supabase = createAdminClient()
    const ext = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg')
    const path = `health-criteria/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
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
  peerUserIds?: string[] | null,
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
      .select('method_id, method_type, options')
      .eq('event_id', eventId)
      .is('deleted_at', null)
    const methodList = methods ?? []
    const hasPeerSelect = methodList.some((r) => (r as { method_type?: string }).method_type === 'PEER_SELECT')
    const normalizedPeerUserIds = [...new Set((peerUserIds ?? []).map((id) => String(id).trim()).filter(Boolean))]
    if (hasPeerSelect && normalizedPeerUserIds.length === 0) {
      return { success: false, error: '칭찬할 동료를 선택해주세요.' }
    }
    const requiredMethods = methodList as {
      method_id: string
      method_type: string
      options?: string[] | null
    }[]
    for (const m of requiredMethods) {
      const val = verificationData[m.method_id]
      if (m.method_type === 'PHOTO') {
        const urls = Array.isArray(val) ? val.filter((u): u is string => typeof u === 'string' && !!u.trim()) : []
        if (urls.length < 1) {
          return { success: false, error: '사진을 1장 이상 제출해주세요.' }
        }
      } else if (m.method_type === 'PEER_SELECT') {
        let selectedCount = 0
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const obj = val as { peer_user_ids?: unknown; organization_name?: unknown }
          selectedCount = Array.isArray(obj.peer_user_ids)
            ? obj.peer_user_ids.filter((x): x is string => typeof x === 'string' && !!x.trim()).length
            : 0
        } else if (Array.isArray(val)) {
          selectedCount = val.filter((x): x is string => typeof x === 'string' && !!x.trim()).length
        } else if (typeof val === 'string' && val.trim()) {
          selectedCount = 1
        }
        if (selectedCount === 0) {
          return { success: false, error: '칭찬할 동료를 1명 이상 선택해주세요.' }
        }
        const isMultiMode = isMultiPeerSelectMode(m)
        if (!isMultiMode && selectedCount > 1) {
          return { success: false, error: '개인형 칭찬 챌린지는 동료 1명만 선택할 수 있습니다.' }
        }
      } else if (val === undefined || val === null || String(val).trim() === '') {
        return { success: false, error: '필수 인증 항목(사진·텍스트 등)을 모두 입력해주세요.' }
      }
    }

    const payloadVerificationData =
      hasPeerSelect && normalizedPeerUserIds.length > 0
        ? { ...verificationData, peer_user_ids: normalizedPeerUserIds }
        : verificationData

    const { error: insertErr } = await supabase.from('event_submissions').insert({
      event_id: eventId,
      round_id: roundId,
      user_id: userId,
      status: 'PENDING',
      verification_data: payloadVerificationData,
      // 기존 스키마 호환: 대표 수신자 1명은 peer_user_id에 유지
      peer_user_id: normalizedPeerUserIds[0] ?? null,
      is_anonymous: hasPeerSelect && !!isAnonymous,
    })
    if (insertErr) {
      if (insertErr.code === '23505') return { success: false, error: '이미 해당 구간에 제출했습니다.' }
      return { success: false, error: insertErr.message }
    }

    // 관리자 승인 대기 건이 생성되면 Google Chat으로 알림을 전송합니다.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_DEV_APP_URL?.trim() ||
      'http://localhost:3000'
    const adminVerificationLink = `${appUrl.replace(/\/+$/, '')}/admin/verifications`
    const roundText = roundId ? '구간 제출' : '상시 제출'
    await sendGoogleChatAdminAlert({
      title: '새 인증 제출(승인 대기)',
      message: [
        `이벤트: ${event.title ?? '이벤트명 없음'}`,
        `제출자 ID: ${userId}`,
        `유형: ${roundText}`,
        `확인 링크: ${adminVerificationLink}`,
      ].join('\n'),
    })

    revalidatePath('/')
    return { success: true, error: null }
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
