import { createClient } from '@/lib/supabase/server'

export async function getUserData(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function getUserDonations(userId: string, limit = 10) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('donations')
    .select(
      `
      *,
      donation_targets (
        name,
        image_url
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data
}

export async function getUserPointTransactions(userId: string, limit = 20) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data
}
