import { createClient } from '@/lib/supabase/server'
import { getSeoulYearMonth } from '@/lib/health-challenge-time'

export type HealthSeasonPublic = {
  season_id: string
  name: string
  slug: string
  starts_at: string
  ends_at: string
  /** 건강 챌린지 시즌이 연결된 이벤트 ID (없을 수도 있어서 null 허용) */
  event_id: string | null
  /** 참가 기준표·안내 파일 URL */
  criteria_attachment_url: string | null
}

export type HealthThresholdRow = { level: number; target_value: number }

export type HealthTrackPublic = {
  track_id: string
  kind: string
  title: string
  sort_order: number
  metric: 'DISTANCE_KM' | 'ELEVATION_M'
  min_distance_km: number | null
  min_speed_kmh: number | null
  min_elevation_m: number | null
  thresholds: HealthThresholdRow[]
}

export type HealthRollupRow = {
  track_id: string
  approved_total: number
  achieved_level: number
}

export type HealthMonthlySubmissionState = {
  allowed: boolean
  reason: 'NONE' | 'PENDING' | 'APPROVED'
}

export type HealthSubmittedTrackInfo = {
  track_id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  activity_date: string
  distance_km: number | null
  speed_kmh: number | null
  elevation_m: number | null
  created_at: string
  /** 관리자 반려 시 사유 (없으면 null) */
  rejection_reason: string | null
}

function isMissingCriteriaAttachmentColumnError(message?: string | null): boolean {
  if (!message) return false
  return message.includes('criteria_attachment_url')
}

function isMissingEventIdColumnError(message?: string | null): boolean {
  if (!message) return false
  return message.includes('event_id')
}

/** 메인·모달: 활성 시즌 + 종목·임계값 (공개 조회) */
export async function getActiveHealthChallengeDefinition(): Promise<{
  season: HealthSeasonPublic | null
  tracks: HealthTrackPublic[]
  error: string | null
}> {
  try {
    const supabase = await createClient()
    let season: HealthSeasonPublic | null = null
    let sErr: { message?: string } | null = null

    const withCriteria = await supabase
      .from('health_challenge_seasons')
      .select('season_id, name, slug, starts_at, ends_at, criteria_attachment_url, event_id')
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    season = withCriteria.data as HealthSeasonPublic | null
    sErr = withCriteria.error

    if (sErr && isMissingEventIdColumnError(sErr.message)) {
      const fallback = await supabase
        .from('health_challenge_seasons')
        .select('season_id, name, slug, starts_at, ends_at, criteria_attachment_url')
        .eq('status', 'ACTIVE')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      season = fallback.data
        ? ({
            ...(fallback.data as Omit<HealthSeasonPublic, 'event_id'>),
            event_id: null,
          } as HealthSeasonPublic)
        : null
      sErr = fallback.error
    }

    if (sErr && isMissingCriteriaAttachmentColumnError(sErr.message)) {
      const fallback = await supabase
        .from('health_challenge_seasons')
        .select('season_id, name, slug, starts_at, ends_at, event_id')
        .eq('status', 'ACTIVE')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      season = fallback.data
        ? ({ ...(fallback.data as Omit<HealthSeasonPublic, 'criteria_attachment_url'>), criteria_attachment_url: null } as HealthSeasonPublic)
        : null
      sErr = fallback.error
    }

    // event_id / criteria_attachment_url 둘 중 하나라도 컬럼이 없으면, 최종적으로는 season이 null일 수 있음.
    // 여기까지 왔는데도 오류가 있으면 실패로 처리.

    if (sErr) return { season: null, tracks: [], error: sErr.message ?? '건강 챌린지 조회 실패' }
    if (!season) return { season: null, tracks: [], error: null }

    const { data: trackRows, error: tErr } = await supabase
      .from('health_challenge_tracks')
      .select('track_id, kind, title, sort_order, metric, min_distance_km, min_speed_kmh, min_elevation_m')
      .eq('season_id', season.season_id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    if (tErr) return { season: season as HealthSeasonPublic, tracks: [], error: tErr.message }
    const tracksList = trackRows ?? []
    if (tracksList.length === 0) return { season: season as HealthSeasonPublic, tracks: [], error: null }

    const trackIds = tracksList.map((t) => t.track_id)
    const { data: thRows } = await supabase
      .from('health_challenge_level_thresholds')
      .select('track_id, level, target_value')
      .in('track_id', trackIds)
      .is('deleted_at', null)
      .order('level', { ascending: true })

    const thByTrack = new Map<string, HealthThresholdRow[]>()
    for (const th of thRows ?? []) {
      const list = thByTrack.get(th.track_id) ?? []
      list.push({ level: th.level, target_value: Number(th.target_value) })
      thByTrack.set(th.track_id, list)
    }

    const tracks: HealthTrackPublic[] = tracksList.map((t) => ({
      track_id: t.track_id,
      kind: t.kind,
      title: t.title,
      sort_order: t.sort_order,
      metric: t.metric as HealthTrackPublic['metric'],
      min_distance_km: t.min_distance_km != null ? Number(t.min_distance_km) : null,
      min_speed_kmh: t.min_speed_kmh != null ? Number(t.min_speed_kmh) : null,
      min_elevation_m: t.min_elevation_m != null ? Number(t.min_elevation_m) : null,
      thresholds: thByTrack.get(t.track_id) ?? [],
    }))

    return { season: season as HealthSeasonPublic, tracks, error: null }
  } catch (e) {
    return {
      season: null,
      tracks: [],
      error: e instanceof Error ? e.message : '건강 챌린지 조회 실패',
    }
  }
}

/** 로그인 사용자: 이번 달(서울) 롤업 + 대기 중 제출 수 */
export async function getHealthChallengeUserProgress(
  userId: string | null
): Promise<{
  year: number
  month: number
  rollups: HealthRollupRow[]
  pendingLogCount: number
  error: string | null
}> {
  const { year, month } = getSeoulYearMonth()
  if (!userId) {
    return { year, month, rollups: [], pendingLogCount: 0, error: null }
  }
  try {
    const supabase = await createClient()
    const { data: season } = await supabase
      .from('health_challenge_seasons')
      .select('season_id')
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (!season) return { year, month, rollups: [], pendingLogCount: 0, error: null }

    const { data: rollups, error: rErr } = await supabase
      .from('health_challenge_monthly_rollups')
      .select('track_id, approved_total, achieved_level')
      .eq('season_id', season.season_id)
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .is('deleted_at', null)

    if (rErr) return { year, month, rollups: [], pendingLogCount: 0, error: rErr.message }

    const { count } = await supabase
      .from('health_challenge_activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', season.season_id)
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .is('deleted_at', null)

    return {
      year,
      month,
      rollups: (rollups ?? []).map((r) => ({
        track_id: r.track_id,
        approved_total: Number(r.approved_total),
        achieved_level: r.achieved_level,
      })),
      pendingLogCount: count ?? 0,
      error: null,
    }
  } catch (e) {
    return {
      year,
      month,
      rollups: [],
      pendingLogCount: 0,
      error: e instanceof Error ? e.message : '진행 현황 조회 실패',
    }
  }
}

/** 메인 카드 버튼 제어용: 이번 달 건강 챌린지 제출 가능 여부 */
export async function getHealthChallengeMonthlySubmissionState(
  userId: string | null
): Promise<HealthMonthlySubmissionState> {
  if (!userId) return { allowed: true, reason: 'NONE' }
  try {
    const { year, month } = getSeoulYearMonth()
    const supabase = await createClient()
    const { data: season } = await supabase
      .from('health_challenge_seasons')
      .select('season_id')
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (!season) return { allowed: true, reason: 'NONE' }

    const pad2 = (n: number) => String(n).padStart(2, '0')
    const startYmd = `${year}-${pad2(month)}-01`
    const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const endYmd = `${year}-${pad2(month)}-${pad2(endDay)}`

    const { data: rows, error } = await supabase
      .from('health_challenge_activity_logs')
      .select('status')
      .eq('season_id', season.season_id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('activity_date', startYmd)
      .lte('activity_date', endYmd)
      .in('status', ['PENDING', 'APPROVED'])
      .limit(1)

    if (error || !rows?.length) return { allowed: true, reason: 'NONE' }
    const status = rows[0]?.status
    if (status === 'PENDING') return { allowed: false, reason: 'PENDING' }
    if (status === 'APPROVED') return { allowed: false, reason: 'APPROVED' }
    return { allowed: true, reason: 'NONE' }
  } catch {
    return { allowed: true, reason: 'NONE' }
  }
}

/** 이번 달 이미 제출한 종목(track_id) 목록(PENDING/APPROVED) */
export async function getHealthChallengeSubmittedTrackIdsThisMonth(
  userId: string | null
): Promise<string[]> {
  const infos = await getHealthChallengeSubmittedTrackInfosThisMonth(userId)
  return infos.map((x) => x.track_id)
}

/** 이번 달 종목별 최신 제출 정보(PENDING/APPROVED) */
export async function getHealthChallengeSubmittedTrackInfosThisMonth(
  userId: string | null
): Promise<HealthSubmittedTrackInfo[]> {
  if (!userId) return []
  try {
    const { year, month } = getSeoulYearMonth()
    const supabase = await createClient()
    const { data: season } = await supabase
      .from('health_challenge_seasons')
      .select('season_id')
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (!season) return []

    const pad2 = (n: number) => String(n).padStart(2, '0')
    const startYmd = `${year}-${pad2(month)}-01`
    const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const endYmd = `${year}-${pad2(month)}-${pad2(endDay)}`

    const { data: rows, error } = await supabase
      .from('health_challenge_activity_logs')
      .select(
        'track_id, status, activity_date, distance_km, speed_kmh, elevation_m, created_at, rejection_reason',
      )
      .eq('season_id', season.season_id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('activity_date', startYmd)
      .lte('activity_date', endYmd)
      .in('status', ['PENDING', 'APPROVED', 'REJECTED'])
      .order('created_at', { ascending: false })

    if (error || !rows?.length) return []

    // 같은 종목 다중 제출이 있어도 카드에는 최신 1건만 표시 (반려 후 재제출 시 최신 건 기준)
    const latestByTrack = new Map<string, HealthSubmittedTrackInfo>()
    for (const row of rows) {
      if (latestByTrack.has(row.track_id)) continue
      if (row.status !== 'PENDING' && row.status !== 'APPROVED' && row.status !== 'REJECTED') continue
      latestByTrack.set(row.track_id, {
        track_id: row.track_id,
        status: row.status,
        activity_date: row.activity_date,
        distance_km: row.distance_km != null ? Number(row.distance_km) : null,
        speed_kmh: row.speed_kmh != null ? Number(row.speed_kmh) : null,
        elevation_m: row.elevation_m != null ? Number(row.elevation_m) : null,
        created_at: row.created_at,
        rejection_reason: row.rejection_reason ?? null,
      })
    }
    return [...latestByTrack.values()]
  } catch {
    return []
  }
}
