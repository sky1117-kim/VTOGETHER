'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type EventRow = {
  event_id: string
  title: string
  description: string | null
  category: 'V_TOGETHER' | 'CULTURE'
  type: 'ALWAYS' | 'SEASONAL'
  reward_policy: 'SENDER_ONLY' | 'BOTH'
  reward_type: 'POINTS' | 'COUPON' | 'CHOICE'
  reward_amount: number | null
  image_url: string | null
  status: 'ACTIVE' | 'PAUSED' | 'ENDED'
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
      .order('created_at', { ascending: false })
    if (error) return { data: null, error: error.message }
    return { data: (data ?? []) as EventRow[], error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '이벤트 목록 조회 실패' }
  }
}

export type VerificationMethodInput = {
  method_type: 'PHOTO' | 'TEXT' | 'VALUE' | 'PEER_SELECT'
  is_required?: boolean
  label?: string | null
  placeholder?: string | null
}

export type CreateEventInput = {
  title: string
  description?: string | null
  category: 'V_TOGETHER' | 'CULTURE'
  type: 'ALWAYS' | 'SEASONAL'
  reward_policy: 'SENDER_ONLY' | 'BOTH'
  reward_type: 'POINTS' | 'COUPON' | 'CHOICE'
  reward_amount?: number | null
  image_url?: string | null
  status?: 'ACTIVE' | 'PAUSED' | 'ENDED'
  verification_methods: VerificationMethodInput[]
}

/** 관리자: 이벤트 생성 (인증 방식 함께 등록) */
export async function createEvent(
  input: CreateEventInput,
  createdBy: string
): Promise<{ eventId: string | null; error: string | null }> {
  const { title, category, type, reward_policy, reward_type, verification_methods } = input
  if (!title?.trim()) return { eventId: null, error: '제목을 입력하세요.' }
  if (!verification_methods?.length) return { eventId: null, error: '인증 방식을 1개 이상 선택하세요.' }

  const reward_amount =
    input.reward_type === 'POINTS' && input.reward_amount != null
      ? Math.max(0, Number(input.reward_amount))
      : null

  try {
    const supabase = createAdminClient()
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: title.trim(),
        description: input.description?.trim() || null,
        category,
        type,
        reward_policy,
        reward_type,
        reward_amount,
        image_url: input.image_url?.trim() || null,
        status: input.status ?? 'ACTIVE',
        created_by: createdBy,
      })
      .select('event_id')
      .single()

    if (eventError || !event) {
      return { eventId: null, error: eventError?.message ?? '이벤트 생성 실패' }
    }

    for (let i = 0; i < verification_methods.length; i++) {
      const m = verification_methods[i]
      const { error: methodError } = await supabase.from('event_verification_methods').insert({
        event_id: event.event_id,
        method_type: m.method_type,
        is_required: m.is_required ?? true,
        label: m.label?.trim() || null,
        placeholder: m.placeholder?.trim() || null,
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
