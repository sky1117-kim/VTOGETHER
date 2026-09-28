'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

export type DonationTargetRow = {
  target_id: string
  name: string
  description: string | null
  image_url: string | null
  target_amount: number
  current_amount: number
  status: 'ACTIVE' | 'COMPLETED'
  payroll_matching_amount: number
  created_at: string
  updated_at: string
}

/** 관리자: 기부처 목록 전체 조회 */
export async function getDonationTargetsForAdmin(): Promise<{
  data: DonationTargetRow[] | null
  error: string | null
}> {
  const auth = await requireAdmin()
  if (!auth.ok) return { data: null, error: auth.error }
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('donation_targets')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) return { data: null, error: error.message }
    return { data: (data ?? []) as DonationTargetRow[], error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '기부처 목록 조회 실패' }
  }
}

export type PayrollPledgeRow = {
  pledge_id: string
  target_id: string
  target_name: string
  user_id: string
  user_name: string | null
  user_email: string | null
  amount: number
  updated_at: string
}

/**
 * 관리자: 특별모금(급여공제) 신청 내역 전체 조회 — 실제 급여공제·매칭 집행 시
 * 누가 얼마를 신청했는지 확인하는 근거 자료로 사용한다.
 */
export async function getPayrollPledgesForAdmin(): Promise<{
  data: PayrollPledgeRow[] | null
  error: string | null
}> {
  const auth = await requireAdmin()
  if (!auth.ok) return { data: null, error: auth.error }
  try {
    const supabase = createAdminClient()
    const { data: pledges, error } = await supabase
      .from('payroll_donation_pledges')
      .select('pledge_id, target_id, user_id, amount, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (error) return { data: null, error: error.message }
    if (!pledges?.length) return { data: [], error: null }

    const targetIds = [...new Set(pledges.map((p) => p.target_id))]
    const userIds = [...new Set(pledges.map((p) => p.user_id))]

    const [{ data: targetsData }, { data: usersData }] = await Promise.all([
      supabase.from('donation_targets').select('target_id, name').in('target_id', targetIds),
      supabase.from('users').select('user_id, name, email').in('user_id', userIds),
    ])
    const targetNameById = new Map((targetsData ?? []).map((t) => [t.target_id, t.name]))
    const userById = new Map((usersData ?? []).map((u) => [u.user_id, u]))

    const rows: PayrollPledgeRow[] = pledges.map((p) => ({
      pledge_id: p.pledge_id,
      target_id: p.target_id,
      target_name: targetNameById.get(p.target_id) ?? p.target_id,
      user_id: p.user_id,
      user_name: userById.get(p.user_id)?.name ?? null,
      user_email: userById.get(p.user_id)?.email ?? null,
      amount: p.amount,
      updated_at: p.updated_at,
    }))
    return { data: rows, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '신청 내역 조회 실패' }
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
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
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

/**
 * 관리자: 특별모금(급여공제) 기부처의 회사 매칭 금액 수정.
 * 실제 급여공제·매칭이 집행된 뒤, 그 결과를 기부처별로 기록한다.
 */
export async function updatePayrollMatchingAmount(
  targetId: string,
  amount: number
): Promise<{ success: boolean; error: string | null }> {
  if (amount < 0 || !Number.isInteger(amount)) {
    return { success: false, error: '매칭 금액은 0 이상의 정수여야 합니다.' }
  }
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('donation_targets')
      .update({ payroll_matching_amount: amount })
      .eq('target_id', targetId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    revalidatePath('/admin/donation-targets')
    revalidatePath('/')
    revalidatePath('/donation')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '매칭 금액 수정 실패' }
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
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  try {
    const supabase = createAdminClient()
    const { data: row, error: fetchError } = await supabase
      .from('donation_targets')
      .select('current_amount, target_amount, status')
      .eq('target_id', targetId)
      .is('deleted_at', null)
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
