'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getEventForParticipation } from '@/api/queries/events'

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

/** 모달용: 이벤트 + 인증 방식 + 구간(현재 로그인 사용자 기준 상태 포함). 인증 방식이 비어 있으면 admin으로 한 번 더 조회 */
export async function getEventForParticipationAction(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const result = await getEventForParticipation(eventId, user?.id ?? null)
  if (result.data && result.data.verificationMethods.length === 0) {
    const admin = createAdminClient()
    const { data: methods } = await admin
      .from('event_verification_methods')
      .select('method_id, method_type, instruction, label, placeholder, input_style')
      .eq('event_id', eventId)
      .order('method_id')
    if (methods?.length) {
      result.data.verificationMethods = methods as typeof result.data.verificationMethods
    }
  }
  return result
}

/**
 * 로그인한 사용자가 이벤트 인증 제출 (메인 페이지 모달에서 호출)
 */
export async function submitEventSubmission(
  eventId: string,
  roundId: string | null,
  verificationData: Record<string, unknown>
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
      .single()
    if (eventErr || !event) return { success: false, error: '이벤트를 찾을 수 없습니다.' }
    if (event.status !== 'ACTIVE') return { success: false, error: '진행 중인 이벤트가 아닙니다.' }

    if (event.type === 'SEASONAL' && !roundId) {
      return { success: false, error: '기간제 이벤트는 구간을 선택하세요.' }
    }
    if (event.type === 'ALWAYS' && roundId) {
      roundId = null
    }

    // 필수 인증 항목(사진·텍스트 등)이 모두 채워졌는지 서버에서 검증
    const { data: methods } = await supabase
      .from('event_verification_methods')
      .select('method_id')
      .eq('event_id', eventId)
    const requiredIds = (methods ?? []).map((r) => (r as { method_id: string }).method_id)
    for (const methodId of requiredIds) {
      const val = verificationData[methodId]
      if (val === undefined || val === null || String(val).trim() === '') {
        return { success: false, error: '필수 인증 항목(사진·텍스트 등)을 모두 입력해주세요.' }
      }
    }

    const { error: insertErr } = await supabase.from('event_submissions').insert({
      event_id: eventId,
      round_id: roundId,
      user_id: userId,
      status: 'PENDING',
      verification_data: verificationData,
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
