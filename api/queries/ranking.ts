import { createClient } from '@/lib/supabase/server'

export type PersonalRankItem = {
  rank: number
  name: string
  dept: string | null
  level: string
  score: number
}

export type TeamRankItem = {
  rank: number
  name: string
  level: string
  score: number
}

export async function getPersonalRanking(limit = 10): Promise<PersonalRankItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('name, dept_name, level, total_donated_amount')
    .is('deleted_at', null)
    .order('total_donated_amount', { ascending: false })
    .limit(limit)
  if (!data?.length) return []
  return data.map((row, i) => ({
    rank: i + 1,
    name: row.name ?? '—',
    dept: row.dept_name ?? null,
    level: row.level === 'EARTH_HERO' ? 'Earth Hero' : row.level === 'GREEN_MASTER' ? 'Green Master' : 'Eco Keeper',
    score: row.total_donated_amount ?? 0,
  }))
}

export async function getTeamRanking(limit = 10): Promise<TeamRankItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('dept_name, total_donated_amount')
    .is('deleted_at', null)
  if (!data?.length) return []
  const byDept = new Map<string, number>()
  for (const row of data) {
    const dept = row.dept_name?.trim() || '미지정'
    byDept.set(dept, (byDept.get(dept) ?? 0) + (row.total_donated_amount ?? 0))
  }
  const sorted = [...byDept.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
  return sorted.map(([name, score], i) => ({
    rank: i + 1,
    name,
    level: '-',
    score,
  }))
}
