import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** 현재 분기의 시작/종료 시각 및 라벨 반환 (명예의 전당 분기별 랭킹용) */
export function getCurrentQuarterBounds(): {
  start: string
  end: string
  label: string
} {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const quarter = Math.floor(month / 3) + 1 // 1~4
  const startMonth = (quarter - 1) * 3
  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, startMonth + 3, 1, 0, 0, 0, 0))
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${year} Q${quarter}`,
  }
}

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
  score: number
  /** 팀 전체 인원 수 */
  totalCount: number
  /** 기부한 인원 수 */
  donatedCount: number
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
  // dept별: { score, totalCount, donatedCount }
  const byDept = new Map<string, { score: number; totalCount: number; donatedCount: number }>()
  for (const row of data) {
    const dept = row.dept_name?.trim() || '미지정'
    const prev = byDept.get(dept) ?? { score: 0, totalCount: 0, donatedCount: 0 }
    prev.score += row.total_donated_amount ?? 0
    prev.totalCount += 1
    if ((row.total_donated_amount ?? 0) > 0) prev.donatedCount += 1
    byDept.set(dept, prev)
  }
  const sorted = [...byDept.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
  return sorted.map(([name, agg], i) => ({
    rank: i + 1,
    name,
    score: agg.score,
    totalCount: agg.totalCount,
    donatedCount: agg.donatedCount,
  }))
}

/**
 * 명예의 전당용: 현재 분기 기부액 기준 개인 랭킹
 * (누적 기부액은 total_donated_amount로 본인/관리자에게 별도 노출)
 *
 * donations 는 RLS로 본인 행만 조회 가능하므로, 공개 랭킹 집계는 서버 전용 관리 클라이언트로만 읽습니다.
 */
export async function getPersonalRankingQuarterly(limit = 10): Promise<PersonalRankItem[]> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { start, end } = getCurrentQuarterBounds()

  const { data: donations } = await admin
    .from('donations')
    .select('user_id, amount')
    .gte('created_at', start)
    .lt('created_at', end)
    .is('deleted_at', null)

  if (!donations?.length) return []

  // user_id별 분기 기부액 합산
  const byUser = new Map<string, number>()
  for (const d of donations) {
    const prev = byUser.get(d.user_id) ?? 0
    byUser.set(d.user_id, prev + (d.amount ?? 0))
  }

  const sorted = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
  const userIds = sorted.map(([id]) => id)
  if (userIds.length === 0) return []

  const { data: users } = await supabase
    .from('users')
    .select('user_id, name, dept_name, level')
    .in('user_id', userIds)
    .is('deleted_at', null)

  const userMap = new Map((users ?? []).map((u) => [u.user_id, u]))
  // 삭제된 사용자 제외 후 상위 N명
  const filtered = sorted.filter(([userId]) => userMap.has(userId)).slice(0, limit)

  return filtered.map(([userId, score], i) => {
    const u = userMap.get(userId)
    return {
      rank: i + 1,
      name: u?.name ?? '—',
      dept: u?.dept_name ?? null,
      level:
        u?.level === 'EARTH_HERO'
          ? 'Earth Hero'
          : u?.level === 'GREEN_MASTER'
            ? 'Green Master'
            : 'Eco Keeper',
      score,
    }
  })
}

/**
 * 명예의 전당용: 현재 분기 기부액 기준 팀 랭킹
 * (donations 집계는 공개 랭킹용으로 관리 클라이언트 사용 — getPersonalRankingQuarterly 와 동일)
 */
export async function getTeamRankingQuarterly(limit = 10): Promise<TeamRankItem[]> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { start, end } = getCurrentQuarterBounds()

  const { data: donations } = await admin
    .from('donations')
    .select('user_id, amount')
    .gte('created_at', start)
    .lt('created_at', end)
    .is('deleted_at', null)

  if (!donations?.length) return []

  // user_id별 분기 기부액 합산
  const byUser = new Map<string, number>()
  for (const d of donations) {
    const prev = byUser.get(d.user_id) ?? 0
    byUser.set(d.user_id, prev + (d.amount ?? 0))
  }

  const donorUserIds = [...byUser.keys()]
  const { data: allUsers } = await supabase
    .from('users')
    .select('user_id, dept_name')
    .is('deleted_at', null)

  const donorSet = new Set(donorUserIds)
  const byDept = new Map<string, { score: number; totalCount: number; donatedCount: number }>()

  for (const row of allUsers ?? []) {
    const dept = row.dept_name?.trim() || '미지정'
    const prev = byDept.get(dept) ?? { score: 0, totalCount: 0, donatedCount: 0 }
    prev.totalCount += 1
    if (donorSet.has(row.user_id)) {
      prev.score += byUser.get(row.user_id) ?? 0
      prev.donatedCount += 1
    }
    byDept.set(dept, prev)
  }

  const sorted = [...byDept.entries()]
    .filter(([, agg]) => agg.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)

  return sorted.map(([name, agg], i) => ({
    rank: i + 1,
    name,
    score: agg.score,
    totalCount: agg.totalCount,
    donatedCount: agg.donatedCount,
  }))
}
