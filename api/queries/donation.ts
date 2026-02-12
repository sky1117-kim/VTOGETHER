import { createClient } from '@/lib/supabase/server'

export async function getDonationTargets() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('donation_targets')
    .select('*')
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
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function getTotalDonationStats() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('donation_targets')
    .select('target_amount, current_amount, status')

  if (error) {
    throw error
  }

  const totalTarget = data.reduce((sum, target) => sum + target.target_amount, 0)
  const totalCurrent = data.reduce((sum, target) => sum + target.current_amount, 0)
  const completedCount = data.filter((target) => target.status === 'COMPLETED').length

  return {
    totalTarget,
    totalCurrent,
    completedCount,
    progress: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0,
  }
}
