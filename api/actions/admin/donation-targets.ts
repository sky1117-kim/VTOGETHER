'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type DonationTargetRow = {
  target_id: string
  name: string
  description: string | null
  image_url: string | null
  target_amount: number
  current_amount: number
  status: 'ACTIVE' | 'COMPLETED'
  created_at: string
  updated_at: string
}

/** 관리자: 기부처 목록 전체 조회 */
export async function getDonationTargetsForAdmin(): Promise<{
  data: DonationTargetRow[] | null
  error: string | null
}> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('donation_targets')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) return { data: null, error: error.message }
    return { data: (data ?? []) as DonationTargetRow[], error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '기부처 목록 조회 실패' }
  }
}

/** 관리자: 기부처 목표 금액 수정 */
export async function updateDonationTargetAmount(
  targetId: string,
  targetAmount: number
): Promise<{ success: boolean; error: string | null }> {
  if (targetAmount < 0 || !Number.isInteger(targetAmount)) {
    return { success: false, error: '목표 금액은 0 이상의 정수여야 합니다.' }
  }
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('donation_targets')
      .update({ target_amount: targetAmount })
      .eq('target_id', targetId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    revalidatePath('/admin/donation-targets')
    revalidatePath('/')
    revalidatePath('/donation')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '목표 수정 실패' }
  }
}

/** 관리자: 오프라인 성금 합산 (current_amount 증액). 목표 도달 시 status를 COMPLETED로 변경 */
export async function addOfflineDonation(
  targetId: string,
  amount: number
): Promise<{ success: boolean; error: string | null }> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    return { success: false, error: '추가할 금액은 1 이상의 정수여야 합니다.' }
  }
  try {
    const supabase = createAdminClient()
    const { data: row, error: fetchError } = await supabase
      .from('donation_targets')
      .select('current_amount, target_amount, status')
      .eq('target_id', targetId)
      .single()
    if (fetchError || !row) {
      return { success: false, error: '기부처를 찾을 수 없습니다.' }
    }
    const newAmount = (row.current_amount ?? 0) + amount
    const newStatus = newAmount >= (row.target_amount ?? 0) ? 'COMPLETED' : row.status
    const { error: updateError } = await supabase
      .from('donation_targets')
      .update({ current_amount: newAmount, status: newStatus })
      .eq('target_id', targetId)
    if (updateError) return { success: false, error: updateError.message }
    revalidatePath('/admin')
    revalidatePath('/admin/donation-targets')
    revalidatePath('/')
    revalidatePath('/donation')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '오프라인 합산 실패' }
  }
}
