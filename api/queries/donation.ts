import { createClient } from '@/lib/supabase/server'
import { PAYROLL_BASED_TARGET_NAMES } from '@/constants/donationTargets'

export async function getDonationTargets() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('donation_targets')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data
}

export async function getDonationTarget(targetId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('donation_targets')
    .select('*')
    .eq('target_id', targetId)
    .is('deleted_at', null)
    .single()

  if (error) {
    throw error
  }

  return data
}

const DEFAULT_ANNUAL_DONATION_GOAL = 40000000

/** 연간 전사 기부 목표액 (기본 4,000만원, admin에서 site_content.annual_donation_goal로 수정 가능) */
export async function getAnnualDonationGoal(): Promise<number> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('site_content')
    .select('value')
    .eq('key', 'annual_donation_goal')
    .maybeSingle()

  const parsed = Number(data?.value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ANNUAL_DONATION_GOAL
}

/**
 * 로그인한 직원 본인의 특별모금(급여공제) 신청 내역 — target_id별 신청 금액.
 * RLS로 본인 행만 조회되므로 별도 user_id 필터 없이도 안전하다.
 */
export async function getMyPayrollPledges(userId: string | null): Promise<Record<string, number>> {
  if (!userId) return {}

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll_donation_pledges')
    .select('target_id, amount')
    .is('deleted_at', null)

  if (error || !data) return {}

  return data.reduce<Record<string, number>>((acc, row) => {
    acc[row.target_id] = row.amount
    return acc
  }, {})
}

export async function getTotalDonationStats() {
  const supabase = await createClient()

  const [{ data, error }, totalTarget] = await Promise.all([
    supabase
      .from('donation_targets')
      .select('name, target_amount, current_amount, status, payroll_matching_amount')
      .is('deleted_at', null),
    getAnnualDonationGoal(),
  ])

  if (error) {
    throw error
  }

  // 급여공제 기반 기부처(네팔 등)의 current_amount는 직원 급여라 예산 합산에서 제외하고,
  // 그 기부처별 매칭분(payroll_matching_amount)만 더한다 — RPC의 전사 합산 체크와 동일한 기준.
  const totalCurrent = data.reduce((sum, target) => {
    if (PAYROLL_BASED_TARGET_NAMES.has(target.name)) return sum + (target.payroll_matching_amount ?? 0)
    return sum + target.current_amount
  }, 0)
  const completedCount = data.filter((target) => target.status === 'COMPLETED').length

  return {
    totalTarget,
    totalCurrent,
    completedCount,
    progress: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0,
  }
}
