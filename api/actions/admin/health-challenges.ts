'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  achievedLevelFromTotal,
  contributedValueForApprovedLog,
  meetsMinimumSessionCriteria,
  medalsFromLevelSum,
  validateSessionForTrack,
  type HealthTrackRule,
} from '@/lib/health-challenge-scoring'
import { yearMonthFromISODate } from '@/lib/health-challenge-time'
import { HEALTH_CHALLENGE_RELATED_TYPE } from '@/constants/health-challenges'
import { DEFAULT_HEALTH_TRACK_SEEDS, slugifyHealthSeasonSlug } from '@/lib/health-challenge-default-season'

/** 시즌 4종목 저장용 (등록·수정 공통) */
export type HealthSeasonTrackPayload = {
  kind: 'WALK' | 'RUN' | 'HIKE' | 'RIDE'
  title: string
  min_distance_km: number | null
  min_speed_kmh: number | null
  min_elevation_m: number | null
  level1: number
  level2: number
  level3: number
}
export type HealthSeasonTracksPayload = HealthSeasonTrackPayload[]

function isMissingCriteriaAttachmentColumnError(message?: string | null): boolean {
  if (!message) return false
  return message.includes('criteria_attachment_url')
}

function isMissingEventIdColumnError(message?: string | null): boolean {
  if (!message) return false
  return message.includes('event_id')
}

function validateHealthTracksPayload(tracks: HealthSeasonTracksPayload): string | null {
  const kindSet = new Set(tracks.map((t) => t.kind))
  if (kindSet.size !== 4 || tracks.length !== 4) {
    return '4종목(걷기·러닝·하이킹·라이딩) 데이터가 모두 필요합니다.'
  }
  for (const t of tracks) {
    if (t.level1 < 0 || t.level2 < 0 || t.level3 < 0) {
      return '레벨 목표는 0 이상이어야 합니다.'
    }
    if (t.level1 > t.level2 || t.level2 > t.level3) {
      return `${t.kind}: L1 ≤ L2 ≤ L3 이 되도록 입력하세요.`
    }
    const seed = DEFAULT_HEALTH_TRACK_SEEDS.find((s) => s.kind === t.kind)
    if (!seed) return '알 수 없는 종목입니다.'
    if (seed.metric === 'DISTANCE_KM') {
      if (t.min_distance_km != null && t.min_distance_km < 0) {
        return '최소 거리(km)는 0 이상이어야 합니다.'
      }
      if (t.min_speed_kmh != null && t.min_speed_kmh < 0) {
        return '최소 속도(km/h)는 0 이상이어야 합니다.'
      }
    }
    if (seed.metric === 'ELEVATION_M' && t.min_elevation_m != null && t.min_elevation_m < 0) {
      return '최소 고도(m)는 0 이상이어야 합니다.'
    }
  }
  return null
}

async function upsertHealthTracksForSeason(
  seasonId: string,
  tracks: HealthSeasonTracksPayload
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()
    const v = validateHealthTracksPayload(tracks)
    if (v) return { success: false, error: v }

    for (const t of tracks) {
      const seed = DEFAULT_HEALTH_TRACK_SEEDS.find((s) => s.kind === t.kind)!
      const title = t.title.trim() || seed.title

      const { data: existing } = await admin
        .from('health_challenge_tracks')
        .select('track_id')
        .eq('season_id', seasonId)
        .eq('kind', t.kind)
        .is('deleted_at', null)
        .maybeSingle()

      let trackId: string
      if (existing?.track_id) {
        trackId = existing.track_id
        const { error: uT } = await admin
          .from('health_challenge_tracks')
          .update({
            title,
            min_distance_km: t.min_distance_km,
            min_speed_kmh: t.min_speed_kmh,
            min_elevation_m: t.min_elevation_m,
          })
          .eq('track_id', trackId)
        if (uT) return { success: false, error: uT.message }
      } else {
        const { data: ins, error: iErr } = await admin
          .from('health_challenge_tracks')
          .insert({
            season_id: seasonId,
            kind: t.kind,
            title,
            sort_order: seed.sort_order,
            metric: seed.metric,
            min_distance_km: t.min_distance_km,
            min_speed_kmh: t.min_speed_kmh,
            min_elevation_m: t.min_elevation_m,
          })
          .select('track_id')
          .single()
        if (iErr || !ins) return { success: false, error: iErr?.message ?? '종목 생성 실패' }
        trackId = ins.track_id
      }

      for (const lv of [1, 2, 3] as const) {
        const val = lv === 1 ? t.level1 : lv === 2 ? t.level2 : t.level3
        const { error: thErr } = await admin.from('health_challenge_level_thresholds').upsert(
          { track_id: trackId, level: lv, target_value: val },
          { onConflict: 'track_id,level' }
        )
        if (thErr) return { success: false, error: thErr.message }
      }
    }
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '종목 저장 실패' }
  }
}

export type HealthActivityLogAdminRow = {
  log_id: string
  season_id: string
  season_name: string | null
  track_id: string
  track_title: string
  /** 거리(km) 또는 고도(m) 집계 기준 */
  track_metric: 'DISTANCE_KM' | 'ELEVATION_M'
  min_distance_km: number | null
  min_speed_kmh: number | null
  min_elevation_m: number | null
  /** 월 누적 L1~L3 목표값 (종목 설정) */
  level_thresholds: { level: number; target_value: number }[]
  /** 해당 연·월에 이미 승인되어 반영된 합계(이 로그·대기 건 미포함) */
  rollup_approved_total: number
  /** 위 합계 기준 달성 레벨 0~3 */
  rollup_achieved_level: number
  /** 로그 1건 승인 시 rollup에 더해지는 값 (km 또는 m) */
  contributed_per_log: number
  /** 종목 최소 조건 대비 부족 시 안내 문구(심사 참고용) */
  minimum_session_warnings: string[]
  user_id: string
  user_name: string | null
  user_email: string | null
  activity_date: string
  distance_km: number | null
  speed_kmh: number | null
  elevation_m: number | null
  photo_urls: string[]
  status: string
  created_at: string
}

export async function getPendingHealthChallengeLogCount(): Promise<number> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return 0
  try {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from('health_challenge_activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .is('deleted_at', null)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export async function getHealthActivityLogsForAdmin(): Promise<{
  data: HealthActivityLogAdminRow[] | null
  error: string | null
}> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { data: null, error: gate.error }
  try {
    const admin = createAdminClient()
    const { data: logs, error: lErr } = await admin
      .from('health_challenge_activity_logs')
      .select(
        'log_id, season_id, track_id, user_id, activity_date, distance_km, speed_kmh, elevation_m, photo_urls, status, created_at'
      )
      .in('status', ['PENDING', 'APPROVED', 'REJECTED'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (lErr) return { data: null, error: lErr.message }
    if (!logs?.length) return { data: [], error: null }

    const trackIds = [...new Set(logs.map((l) => l.track_id))]
    const userIds = [...new Set(logs.map((l) => l.user_id))]
    const seasonIds = [...new Set(logs.map((l) => l.season_id))]

    const [tracksRes, usersRes, thresholdsRes, rollupsRes, seasonsRes] = await Promise.all([
      admin
        .from('health_challenge_tracks')
        .select('track_id, title, metric, min_distance_km, min_speed_kmh, min_elevation_m')
        .in('track_id', trackIds)
        .is('deleted_at', null),
      admin.from('users').select('user_id, name, email').in('user_id', userIds).is('deleted_at', null),
      admin
        .from('health_challenge_level_thresholds')
        .select('track_id, level, target_value')
        .in('track_id', trackIds)
        .is('deleted_at', null)
        .order('level', { ascending: true }),
      admin
        .from('health_challenge_monthly_rollups')
        .select('season_id, track_id, user_id, year, month, approved_total, achieved_level')
        .in('season_id', seasonIds)
        .in('user_id', userIds)
        .in('track_id', trackIds)
        .is('deleted_at', null),
      admin.from('health_challenge_seasons').select('season_id, name').in('season_id', seasonIds).is('deleted_at', null),
    ])

    const trackById = new Map(
      (tracksRes.data ?? []).map((t) => [
        t.track_id,
        {
          title: t.title,
          metric: t.metric as HealthTrackRule['metric'],
          min_distance_km: t.min_distance_km != null ? Number(t.min_distance_km) : null,
          min_speed_kmh: t.min_speed_kmh != null ? Number(t.min_speed_kmh) : null,
          min_elevation_m: t.min_elevation_m != null ? Number(t.min_elevation_m) : null,
        },
      ])
    )

    const thByTrack = new Map<string, { level: number; target_value: number }[]>()
    for (const row of thresholdsRes.data ?? []) {
      const tid = row.track_id
      if (!thByTrack.has(tid)) thByTrack.set(tid, [])
      thByTrack.get(tid)!.push({ level: row.level, target_value: Number(row.target_value) })
    }
    for (const [, arr] of thByTrack) {
      arr.sort((a, b) => a.level - b.level)
    }

    const rollupMap = new Map<
      string,
      { approved_total: number; achieved_level: number }
    >()
    for (const r of rollupsRes.data ?? []) {
      const key = `${r.season_id}|${r.track_id}|${r.user_id}|${r.year}|${r.month}`
      rollupMap.set(key, {
        approved_total: Number(r.approved_total ?? 0),
        achieved_level: Number(r.achieved_level ?? 0),
      })
    }

    const seasonNameById = new Map((seasonsRes.data ?? []).map((s) => [s.season_id, s.name ?? null]))
    const uMap = new Map((usersRes.data ?? []).map((u) => [u.user_id, u]))

    const rows: HealthActivityLogAdminRow[] = logs.map((l) => {
      const tr = trackById.get(l.track_id)
      const title = tr?.title ?? '—'
      const metric = tr?.metric ?? 'DISTANCE_KM'
      const rule: HealthTrackRule = {
        metric,
        min_distance_km: tr?.min_distance_km ?? null,
        min_speed_kmh: tr?.min_speed_kmh ?? null,
        min_elevation_m: tr?.min_elevation_m ?? null,
      }
      const logInput = {
        distance_km: l.distance_km != null ? Number(l.distance_km) : null,
        speed_kmh: l.speed_kmh != null ? Number(l.speed_kmh) : null,
        elevation_m: l.elevation_m != null ? Number(l.elevation_m) : null,
      }
      const ym = yearMonthFromISODate(l.activity_date)
      const rk = ym ? `${l.season_id}|${l.track_id}|${l.user_id}|${ym.year}|${ym.month}` : ''
      const rollup = rk ? rollupMap.get(rk) : undefined
      const minCheck = meetsMinimumSessionCriteria(rule, logInput)

      return {
        log_id: l.log_id,
        season_id: l.season_id,
        season_name: seasonNameById.get(l.season_id) ?? null,
        track_id: l.track_id,
        track_title: title,
        track_metric: metric,
        min_distance_km: rule.min_distance_km,
        min_speed_kmh: rule.min_speed_kmh,
        min_elevation_m: rule.min_elevation_m,
        level_thresholds: thByTrack.get(l.track_id) ?? [],
        rollup_approved_total: rollup?.approved_total ?? 0,
        rollup_achieved_level: rollup?.achieved_level ?? 0,
        contributed_per_log: contributedValueForApprovedLog(rule, logInput),
        minimum_session_warnings: minCheck.warnings,
        user_id: l.user_id,
        user_name: uMap.get(l.user_id)?.name ?? null,
        user_email: uMap.get(l.user_id)?.email ?? null,
        activity_date: l.activity_date,
        distance_km: logInput.distance_km,
        speed_kmh: logInput.speed_kmh,
        elevation_m: logInput.elevation_m,
        photo_urls: Array.isArray(l.photo_urls) ? (l.photo_urls as string[]) : [],
        status: l.status,
        created_at: l.created_at,
      }
    })

    return { data: rows, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '목록 조회 실패' }
  }
}

async function getReviewerId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function approveHealthActivityLog(logId: string): Promise<{ success: boolean; error: string | null }> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { success: false, error: gate.error }
  const reviewerId = gate.userId

  try {
    const admin = createAdminClient()
    const { data: log, error: lErr } = await admin
      .from('health_challenge_activity_logs')
      .select('log_id, season_id, track_id, user_id, activity_date, distance_km, speed_kmh, elevation_m, status')
      .eq('log_id', logId)
      .is('deleted_at', null)
      .single()

    if (lErr || !log) return { success: false, error: '로그를 찾을 수 없습니다.' }
    if (log.status !== 'PENDING') return { success: false, error: '이미 처리된 건입니다.' }

    const { data: track, error: tErr } = await admin
      .from('health_challenge_tracks')
      .select('track_id, title, metric, min_distance_km, min_speed_kmh, min_elevation_m')
      .eq('track_id', log.track_id)
      .is('deleted_at', null)
      .single()

    if (tErr || !track) return { success: false, error: '종목 정보를 찾을 수 없습니다.' }

    const rule: HealthTrackRule = {
      metric: track.metric as HealthTrackRule['metric'],
      min_distance_km: track.min_distance_km != null ? Number(track.min_distance_km) : null,
      min_speed_kmh: track.min_speed_kmh != null ? Number(track.min_speed_kmh) : null,
      min_elevation_m: track.min_elevation_m != null ? Number(track.min_elevation_m) : null,
    }

    const logInput = {
      distance_km: log.distance_km != null ? Number(log.distance_km) : null,
      speed_kmh: log.speed_kmh != null ? Number(log.speed_kmh) : null,
      elevation_m: log.elevation_m != null ? Number(log.elevation_m) : null,
    }

    const v = validateSessionForTrack(rule, logInput)
    if (!v.ok) return { success: false, error: v.message }

    const contributed = contributedValueForApprovedLog(rule, logInput)
    const ym = yearMonthFromISODate(log.activity_date)
    if (!ym) return { success: false, error: '활동일이 올바르지 않습니다.' }

    const { data: thresholds } = await admin
      .from('health_challenge_level_thresholds')
      .select('level, target_value')
      .eq('track_id', log.track_id)
      .is('deleted_at', null)
      .order('level', { ascending: true })

    const thList = (thresholds ?? []).map((t) => ({
      level: t.level,
      target_value: Number(t.target_value),
    }))

    const { data: existingRollup } = await admin
      .from('health_challenge_monthly_rollups')
      .select('rollup_id, approved_total, achieved_level')
      .eq('season_id', log.season_id)
      .eq('track_id', log.track_id)
      .eq('user_id', log.user_id)
      .eq('year', ym.year)
      .eq('month', ym.month)
      .is('deleted_at', null)
      .maybeSingle()

    const prev = existingRollup ? Number(existingRollup.approved_total) : 0
    const prevAchieved = existingRollup ? Number(existingRollup.achieved_level ?? 0) : 0
    const newTotal = prev + contributed
    const achieved = achievedLevelFromTotal(newTotal, thList)

    if (existingRollup) {
      const { error: uErr } = await admin
        .from('health_challenge_monthly_rollups')
        .update({ approved_total: newTotal, achieved_level: achieved })
        .eq('rollup_id', existingRollup.rollup_id)
      if (uErr) return { success: false, error: uErr.message }
    } else {
      const { error: iErr } = await admin.from('health_challenge_monthly_rollups').insert({
        season_id: log.season_id,
        track_id: log.track_id,
        user_id: log.user_id,
        year: ym.year,
        month: ym.month,
        approved_total: newTotal,
        achieved_level: achieved,
      })
      if (iErr) return { success: false, error: iErr.message }
    }

    const { data: updatedLog, error: logUpd } = await admin
      .from('health_challenge_activity_logs')
      .update({
        status: 'APPROVED',
        contributed_value: contributed,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('log_id', logId)
      .eq('status', 'PENDING')
      .select('log_id')
      .maybeSingle()

    if (logUpd) return { success: false, error: logUpd.message }
    if (!updatedLog) return { success: false, error: '이미 처리된 건입니다.' }

    // 승인 즉시 지급: 달성 레벨 상승분(delta) 만큼 V.Medal 지급
    const deltaLevel = Math.max(0, achieved - prevAchieved)
    if (deltaLevel > 0) {
      // 시즌 연결 이벤트의 V.Medal 보상 수량을 레벨당 지급량으로 사용 (없으면 1)
      let perLevelMedals = 1
      const seasonMeta = await admin
        .from('health_challenge_seasons')
        .select('event_id')
        .eq('season_id', log.season_id)
        .is('deleted_at', null)
        .maybeSingle()

      const linkedEventId =
        seasonMeta.error && isMissingEventIdColumnError(seasonMeta.error.message)
          ? null
          : ((seasonMeta.data as { event_id?: string | null } | null)?.event_id ?? null)

      if (linkedEventId) {
        const { data: evReward } = await admin
          .from('event_rewards')
          .select('amount')
          .eq('event_id', linkedEventId)
          .eq('reward_kind', 'V_MEDAL')
          .is('deleted_at', null)
          .order('display_order', { ascending: true })
          .limit(1)
          .maybeSingle()

        const amt = Number(evReward?.amount ?? 0)
        if (Number.isFinite(amt) && amt > 0) perLevelMedals = amt
      }

      const medalAmount = deltaLevel * perLevelMedals
      if (medalAmount > 0) {
        const { data: urow, error: uErr } = await admin
          .from('users')
          .select('user_id, current_medals, name, email')
          .eq('user_id', log.user_id)
          .is('deleted_at', null)
          .single()
        if (uErr || !urow) return { success: false, error: '사용자 메달 적립 대상 조회 실패' }

        const newMedals = Number(urow.current_medals ?? 0) + medalAmount
        const { error: upUser } = await admin.from('users').update({ current_medals: newMedals }).eq('user_id', log.user_id)
        if (upUser) return { success: false, error: upUser.message }

        // 월별 누적 지급 스냅샷(중복 정산 방지용)
        const { data: paidRow } = await admin
          .from('health_challenge_monthly_settlements')
          .select('settlement_id, medal_amount')
          .eq('season_id', log.season_id)
          .eq('user_id', log.user_id)
          .eq('year', ym.year)
          .eq('month', ym.month)
          .is('deleted_at', null)
          .maybeSingle()

        const { data: monthRollups } = await admin
          .from('health_challenge_monthly_rollups')
          .select('achieved_level')
          .eq('season_id', log.season_id)
          .eq('user_id', log.user_id)
          .eq('year', ym.year)
          .eq('month', ym.month)
          .is('deleted_at', null)
        const levelSum = (monthRollups ?? []).reduce((acc, r) => acc + Number(r.achieved_level ?? 0), 0)

        if (paidRow?.settlement_id) {
          await admin
            .from('health_challenge_monthly_settlements')
            .update({
              status: 'PAID',
              level_sum: levelSum,
              medal_amount: Number(paidRow.medal_amount ?? 0) + medalAmount,
              paid_at: new Date().toISOString(),
            })
            .eq('settlement_id', paidRow.settlement_id)
        } else {
          await admin.from('health_challenge_monthly_settlements').insert({
            season_id: log.season_id,
            user_id: log.user_id,
            year: ym.year,
            month: ym.month,
            level_sum: levelSum,
            medal_amount: medalAmount,
            status: 'PAID',
            paid_at: new Date().toISOString(),
          })
        }

        const trackLabel = (track.title ?? '').trim() || '건강 챌린지'
        await admin.from('point_transactions').insert({
          user_id: log.user_id,
          type: 'EARNED',
          amount: medalAmount,
          currency_type: 'V_MEDAL',
          related_id: log.log_id,
          related_type: HEALTH_CHALLENGE_RELATED_TYPE,
          description: `${trackLabel} 레벨 ${achieved} 달성`,
          user_email: urow.email ?? null,
          user_name: urow.name ?? null,
        })
      }
    }

    revalidatePath('/admin/verifications')
    revalidatePath('/')
    revalidatePath('/my')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '승인 실패' }
  }
}

export async function rejectHealthActivityLog(
  logId: string,
  reason?: string | null
): Promise<{ success: boolean; error: string | null }> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { success: false, error: gate.error }
  const reviewerId = gate.userId

  try {
    const admin = createAdminClient()
    const { data: log } = await admin
      .from('health_challenge_activity_logs')
      .select('status')
      .eq('log_id', logId)
      .is('deleted_at', null)
      .single()

    if (!log) return { success: false, error: '로그를 찾을 수 없습니다.' }
    if (log.status !== 'PENDING') return { success: false, error: '이미 처리된 건입니다.' }

    const { data: updatedLog, error } = await admin
      .from('health_challenge_activity_logs')
      .update({
        status: 'REJECTED',
        rejection_reason: reason?.trim() || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('log_id', logId)
      .eq('status', 'PENDING')
      .select('log_id')
      .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!updatedLog) return { success: false, error: '이미 처리된 건입니다.' }
    revalidatePath('/admin/verifications')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '반려 실패' }
  }
}

/** 한 사람의 대기 인증을 한 번에 승인 */
export async function approveAllPendingHealthActivityLogsForUser(
  userId: string
): Promise<{ success: boolean; approved: number; error: string | null }> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { success: false, approved: 0, error: gate.error }

  try {
    const admin = createAdminClient()
    const { data: logs, error } = await admin
      .from('health_challenge_activity_logs')
      .select('log_id')
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) return { success: false, approved: 0, error: error.message }
    if (!logs?.length) return { success: true, approved: 0, error: null }

    let approved = 0
    for (const row of logs) {
      const r = await approveHealthActivityLog(row.log_id)
      if (!r.success) {
        return {
          success: false,
          approved,
          error: r.error ?? `${approved + 1}번째 승인 처리 중 오류가 발생했습니다.`,
        }
      }
      approved++
    }
    return { success: true, approved, error: null }
  } catch (e) {
    return {
      success: false,
      approved: 0,
      error: e instanceof Error ? e.message : '일괄 승인 실패',
    }
  }
}

/** 한 사람의 대기 인증을 한 번에 반려 */
export async function rejectAllPendingHealthActivityLogsForUser(
  userId: string,
  reason?: string | null
): Promise<{ success: boolean; rejected: number; error: string | null }> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { success: false, rejected: 0, error: gate.error }

  try {
    const admin = createAdminClient()
    const { data: logs, error } = await admin
      .from('health_challenge_activity_logs')
      .select('log_id')
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) return { success: false, rejected: 0, error: error.message }
    if (!logs?.length) return { success: true, rejected: 0, error: null }

    let rejected = 0
    for (const row of logs) {
      const r = await rejectHealthActivityLog(row.log_id, reason)
      if (!r.success) {
        return {
          success: false,
          rejected,
          error: r.error ?? `${rejected + 1}번째 반려 처리 중 오류가 발생했습니다.`,
        }
      }
      rejected++
    }
    return { success: true, rejected, error: null }
  } catch (e) {
    return {
      success: false,
      rejected: 0,
      error: e instanceof Error ? e.message : '일괄 반려 실패',
    }
  }
}

/** 해당 월 정산: 사용자별 (종목 달성 레벨 합)만큼 V.Medal 지급 (상한 12). 이미 PAID면 건너뜀. */
export async function runHealthChallengeMonthlySettlement(
  seasonId: string,
  year: number,
  month: number
): Promise<{ success: boolean; paidUsers: number; error: string | null }> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { success: false, paidUsers: 0, error: gate.error }

  if (month < 1 || month > 12 || year < 2020) {
    return { success: false, paidUsers: 0, error: '연·월을 확인하세요.' }
  }

  try {
    const admin = createAdminClient()
    // 시즌에 연결된 이벤트의 V.Medal 보상 수량을 "레벨 1당 지급량"으로 사용.
    // 미연결/조회 실패 시 기존 기본값(1레벨=1M, 최대 12M)으로 폴백.
    let perLevelMedals = 1
    let maxMonthlyMedals = 12
    const seasonMeta = await admin
      .from('health_challenge_seasons')
      .select('event_id')
      .eq('season_id', seasonId)
      .is('deleted_at', null)
      .maybeSingle()

    const linkedEventId =
      seasonMeta.error && isMissingEventIdColumnError(seasonMeta.error.message)
        ? null
        : ((seasonMeta.data as { event_id?: string | null } | null)?.event_id ?? null)
    if (linkedEventId) {
      const { data: evReward } = await admin
        .from('event_rewards')
        .select('amount')
        .eq('event_id', linkedEventId)
        .eq('reward_kind', 'V_MEDAL')
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      const amt = Number(evReward?.amount ?? 0)
      if (Number.isFinite(amt) && amt > 0) {
        perLevelMedals = amt
        maxMonthlyMedals = amt * 12 // 4종목 * 레벨3
      }
    }

    const { data: tracks } = await admin
      .from('health_challenge_tracks')
      .select('track_id')
      .eq('season_id', seasonId)
      .is('deleted_at', null)

    const trackIds = (tracks ?? []).map((t) => t.track_id)
    if (trackIds.length === 0) {
      return { success: false, paidUsers: 0, error: '종목이 없습니다.' }
    }

    const { data: rollups } = await admin
      .from('health_challenge_monthly_rollups')
      .select('user_id, track_id, achieved_level')
      .eq('season_id', seasonId)
      .eq('year', year)
      .eq('month', month)
      .is('deleted_at', null)

    const userIds = [...new Set((rollups ?? []).map((r) => r.user_id))]
    if (userIds.length === 0) {
      return { success: true, paidUsers: 0, error: null }
    }

    let paidUsers = 0

    for (const userId of userIds) {
      const { data: existing } = await admin
        .from('health_challenge_monthly_settlements')
        .select('settlement_id, status')
        .eq('season_id', seasonId)
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .is('deleted_at', null)
        .maybeSingle()

      if (existing?.status === 'PAID') continue

      let levelSum = 0
      for (const tid of trackIds) {
        const r = (rollups ?? []).find((x) => x.user_id === userId && x.track_id === tid)
        levelSum += r?.achieved_level ?? 0
      }

      const medalAmount = medalsFromLevelSum(levelSum, {
        perLevelMedals,
        maxMonthlyMedals,
      })
      if (medalAmount <= 0) continue

      const { data: urow, error: uErr } = await admin
        .from('users')
        .select('user_id, current_medals, name, email')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single()

      if (uErr || !urow) continue

      const { data: inserted, error: insErr } = await admin
        .from('health_challenge_monthly_settlements')
        .insert({
          season_id: seasonId,
          user_id: userId,
          year,
          month,
          level_sum: levelSum,
          medal_amount: medalAmount,
          status: 'PAID',
          paid_at: new Date().toISOString(),
        })
        .select('settlement_id')
        .single()

      if (insErr) {
        if (insErr.code === '23505') continue
        continue
      }

      const settlementId = inserted?.settlement_id
      const newMedals = (urow.current_medals ?? 0) + medalAmount

      const { error: upUser } = await admin.from('users').update({ current_medals: newMedals }).eq('user_id', userId)
      if (upUser) continue

      await admin.from('point_transactions').insert({
        user_id: userId,
        type: 'EARNED',
        amount: medalAmount,
        currency_type: 'V_MEDAL',
        related_id: settlementId ?? null,
        related_type: HEALTH_CHALLENGE_RELATED_TYPE,
        description: `건강 챌린지 ${year}년 ${month}월 정산 (${levelSum}레벨 합 → ${medalAmount} M)`,
        user_email: urow.email ?? null,
        user_name: urow.name ?? null,
      })

      paidUsers++
    }

    revalidatePath('/admin/health-challenges')
    revalidatePath('/admin/verifications')
    revalidatePath('/')
    revalidatePath('/my')
    return { success: true, paidUsers, error: null }
  } catch (e) {
    return {
      success: false,
      paidUsers: 0,
      error: e instanceof Error ? e.message : '정산 실패',
    }
  }
}

export type HealthSeasonAdminRow = {
  season_id: string
  name: string
  slug: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  starts_at: string
  ends_at: string
  created_at: string
  /** 연결된 이벤트(이벤트 등록 화면에서 함께 생성한 경우) */
  event_id: string | null
}

/** 관리자: 시즌 목록 (정산·목록 화면) */
export async function getHealthSeasonsForAdmin(): Promise<HealthSeasonAdminRow[]> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return []
  try {
    const admin = createAdminClient()
    const withEventId = await admin
      .from('health_challenge_seasons')
      .select('season_id, name, slug, status, starts_at, ends_at, created_at, event_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (!withEventId.error) return (withEventId.data ?? []) as HealthSeasonAdminRow[]

    if (isMissingEventIdColumnError(withEventId.error?.message)) {
      const fallback = await admin
        .from('health_challenge_seasons')
        .select('season_id, name, slug, status, starts_at, ends_at, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      return (fallback.data ?? []).map((row) => ({
        ...(row as Omit<HealthSeasonAdminRow, 'event_id'>),
        event_id: null,
      }))
    }
    return []
  } catch {
    return []
  }
}

async function assertIsAdmin(): Promise<{ userId: string } | { error: string }> {
  const uid = await getReviewerId()
  if (!uid) return { error: '로그인이 필요합니다.' }
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('users')
    .select('is_admin')
    .eq('user_id', uid)
    .is('deleted_at', null)
    .maybeSingle()
  if (!row?.is_admin) return { error: '관리자만 사용할 수 있습니다.' }
  return { userId: uid }
}

/** 시즌에 4종목 + L1~L3 임계값이 없으면 생성 (기획표 기본값) */
export async function ensureDefaultTracksAndThresholds(
  seasonId: string
): Promise<{ success: boolean; error: string | null }> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { success: false, error: gate.error }

  try {
    const admin = createAdminClient()
    for (const def of DEFAULT_HEALTH_TRACK_SEEDS) {
      let trackId: string | null = null
      const { data: existing } = await admin
        .from('health_challenge_tracks')
        .select('track_id')
        .eq('season_id', seasonId)
        .eq('kind', def.kind)
        .is('deleted_at', null)
        .maybeSingle()

      if (existing?.track_id) {
        trackId = existing.track_id
      } else {
        const { data: ins, error: insErr } = await admin
          .from('health_challenge_tracks')
          .insert({
            season_id: seasonId,
            kind: def.kind,
            title: def.title,
            sort_order: def.sort_order,
            metric: def.metric,
            min_distance_km: def.min_distance_km,
            min_speed_kmh: def.min_speed_kmh,
            min_elevation_m: def.min_elevation_m,
          })
          .select('track_id')
          .single()
        if (insErr || !ins) return { success: false, error: insErr?.message ?? '종목 생성 실패' }
        trackId = ins.track_id
      }

      for (let lv = 1; lv <= 3; lv++) {
        const target_value = def.level_targets[lv - 1]
        const { error: thErr } = await admin.from('health_challenge_level_thresholds').upsert(
          { track_id: trackId, level: lv, target_value },
          { onConflict: 'track_id,level' }
        )
        if (thErr) return { success: false, error: thErr.message }
      }
    }
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '기본 종목 설정 실패' }
  }
}

/** 건강 챌린지 시즌 생성 후 4종목·레벨 구성(직접 지정 또는 기본값). ACTIVE로 열면 다른 ACTIVE 시즌은 보관 처리. */
export async function createHealthSeason(input: {
  name: string
  slug: string
  startDate: string
  endDate: string
  status: 'DRAFT' | 'ACTIVE'
  /** 이미 만든 People 이벤트와 1:1 연결 (이벤트 등록 화면에서 사용) */
  eventId?: string | null
  /** 참가 기준표 등 공개 URL */
  criteriaAttachmentUrl?: string | null
  /** 4종목 전부 지정 시 이 값으로 저장하고, 비우면 기획 기본 종목·레벨 */
  tracks?: HealthSeasonTracksPayload | null
}): Promise<{ success: boolean; seasonId?: string; error: string | null }> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { success: false, error: gate.error }

  const name = input.name.trim()
  if (!name) return { success: false, error: '시즌 이름을 입력하세요.' }

  const eventId = input.eventId?.trim() || null

  const slug =
    input.slug.trim().length > 0
      ? slugifyHealthSeasonSlug(input.slug)
      : `hc-${input.startDate.replace(/-/g, '')}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`

  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return { success: false, error: '슬러그는 영문 소문자·숫자·하이픈만 사용 가능합니다.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
    return { success: false, error: '시작일·종료일을 YYYY-MM-DD로 입력하세요.' }
  }
  if (input.startDate > input.endDate) {
    return { success: false, error: '종료일이 시작일보다 빠를 수 없습니다.' }
  }

  try {
    const admin = createAdminClient()

    let canUseEventIdColumn = true
    if (eventId) {
      const { data: ev, error: evErr } = await admin
        .from('events')
        .select('event_id, category')
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .maybeSingle()

      if (evErr || !ev) {
        return { success: false, error: '연결할 이벤트를 찾을 수 없습니다.' }
      }
      if (ev.category !== 'PEOPLE') {
        return { success: false, error: 'People 이벤트만 건강 챌린지 시즌과 연결할 수 있습니다.' }
      }

      const linkedQuery = await admin
        .from('health_challenge_seasons')
        .select('season_id')
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .maybeSingle()

      if (linkedQuery.error && isMissingEventIdColumnError(linkedQuery.error.message)) {
        canUseEventIdColumn = false
      } else if (linkedQuery.error) {
        return { success: false, error: linkedQuery.error.message }
      } else if (linkedQuery.data) {
        return { success: false, error: '이 이벤트는 이미 건강 챌린지 시즌과 연결되어 있습니다.' }
      }
    }

    if (input.status === 'ACTIVE') {
      await admin
        .from('health_challenge_seasons')
        .update({ status: 'ARCHIVED' })
        .eq('status', 'ACTIVE')
        .is('deleted_at', null)
    }

    const criteriaUrl = input.criteriaAttachmentUrl?.trim() || null
    const baseInsertPayload = {
      name,
      slug,
      starts_at: `${input.startDate}T00:00:00+09:00`,
      ends_at: `${input.endDate}T23:59:59.999+09:00`,
      status: input.status,
      ...(eventId && canUseEventIdColumn ? { event_id: eventId } : {}),
    }

    let season: { season_id: string } | null = null
    let sErr: { code?: string; message?: string } | null = null

    if (criteriaUrl) {
      const withCriteria = await admin
        .from('health_challenge_seasons')
        .insert({
          ...baseInsertPayload,
          criteria_attachment_url: criteriaUrl,
        })
        .select('season_id')
        .single()
      season = withCriteria.data
      sErr = withCriteria.error
      if (sErr && (isMissingCriteriaAttachmentColumnError(sErr.message) || isMissingEventIdColumnError(sErr.message))) {
        const fallback = await admin
          .from('health_challenge_seasons')
          .insert(baseInsertPayload)
          .select('season_id')
          .single()
        season = fallback.data
        sErr = fallback.error
      }
    } else {
      const fallback = await admin
        .from('health_challenge_seasons')
        .insert(baseInsertPayload)
        .select('season_id')
        .single()
      season = fallback.data
      sErr = fallback.error
    }

    if (sErr || !season) {
      if (sErr?.code === '23505') {
        return {
          success: false,
          error: sErr.message?.includes('event_id')
            ? '이 이벤트에 이미 시즌이 연결되어 있습니다.'
            : '이미 사용 중인 슬러그입니다. 다른 값을 입력하세요.',
        }
      }
      return { success: false, error: sErr?.message ?? '시즌 생성 실패' }
    }

    const customTracks = input.tracks
    if (customTracks && customTracks.length === 4) {
      const applied = await upsertHealthTracksForSeason(season.season_id, customTracks)
      if (!applied.success) {
        return { success: false, error: applied.error ?? '종목 저장 실패' }
      }
    } else {
      const seeded = await ensureDefaultTracksAndThresholds(season.season_id)
      if (!seeded.success) {
        return { success: false, error: seeded.error ?? '종목 자동 구성 실패' }
      }
    }

    revalidatePath('/admin/health-challenges')
    revalidatePath('/admin/events')
    revalidatePath('/')
    return { success: true, seasonId: season.season_id, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '시즌 생성 실패' }
  }
}

/** 시즌 상태 변경. ACTIVE로 바꾸면 다른 ACTIVE 시즌은 ARCHIVED. */
export async function updateHealthSeasonStatus(
  seasonId: string,
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
): Promise<{ success: boolean; error: string | null }> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { success: false, error: gate.error }

  try {
    const admin = createAdminClient()
    if (status === 'ACTIVE') {
      await admin
        .from('health_challenge_seasons')
        .update({ status: 'ARCHIVED' })
        .eq('status', 'ACTIVE')
        .neq('season_id', seasonId)
        .is('deleted_at', null)
    }
    const { error } = await admin
      .from('health_challenge_seasons')
      .update({ status })
      .eq('season_id', seasonId)
      .is('deleted_at', null)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/health-challenges')
    revalidatePath('/')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '상태 변경 실패' }
  }
}

/** 기존 시즌에 종목·레벨이 비어 있을 때 수동으로 기본값 채우기 */
export async function refillDefaultTracksForSeason(
  seasonId: string
): Promise<{ success: boolean; error: string | null }> {
  const r = await ensureDefaultTracksAndThresholds(seasonId)
  if (!r.success) return r
  revalidatePath('/admin/health-challenges')
  revalidatePath('/admin/events')
  revalidatePath('/')
  return { success: true, error: null }
}

/** 이벤트 수정 화면용: 종목 1행 */
export type LinkedHealthSeasonEditorTrackRow = {
  track_id: string | null
  kind: 'WALK' | 'RUN' | 'HIKE' | 'RIDE'
  title: string
  metric: 'DISTANCE_KM' | 'ELEVATION_M'
  sort_order: number
  min_distance_km: number | null
  min_speed_kmh: number | null
  min_elevation_m: number | null
  level1: number
  level2: number
  level3: number
}

/** 이벤트에 연결된 시즌 + 4종목 편집용 스냅샷 */
export type LinkedHealthSeasonEditorData = {
  season_id: string
  name: string
  slug: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  startDate: string
  endDate: string
  criteria_attachment_url: string | null
  tracks: LinkedHealthSeasonEditorTrackRow[]
}

function seoulYmdFromIso(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  } catch {
    return ''
  }
}

/** People 이벤트에 연결된 건강 시즌 조회 (없으면 data null) */
export async function getLinkedHealthSeasonForEvent(
  eventId: string
): Promise<{ data: LinkedHealthSeasonEditorData | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    let season: {
      season_id: string
      name: string
      slug: string
      status: string
      starts_at: string
      ends_at: string
      criteria_attachment_url?: string | null
    } | null = null
    let sErr: { message?: string } | null = null

    const withCriteria = await admin
      .from('health_challenge_seasons')
      .select('season_id, name, slug, status, starts_at, ends_at, criteria_attachment_url')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .maybeSingle()
    season = withCriteria.data
    sErr = withCriteria.error

    if (sErr && (isMissingCriteriaAttachmentColumnError(sErr.message) || isMissingEventIdColumnError(sErr.message))) {
      const fallback = await admin
        .from('health_challenge_seasons')
        .select('season_id, name, slug, status, starts_at, ends_at')
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .maybeSingle()
      season = fallback.data
      sErr = fallback.error
    }

    if (sErr && isMissingEventIdColumnError(sErr.message)) {
      return { data: null, error: 'DB에 event_id 컬럼이 없습니다. 034 마이그레이션을 먼저 적용하세요.' }
    }
    if (sErr) return { data: null, error: sErr.message ?? '건강 시즌 조회 실패' }
    if (!season) return { data: null, error: null }

    const { data: trackRows } = await admin
      .from('health_challenge_tracks')
      .select('track_id, kind, title, sort_order, metric, min_distance_km, min_speed_kmh, min_elevation_m')
      .eq('season_id', season.season_id)
      .is('deleted_at', null)

    const trackList = trackRows ?? []
    const trackIds = trackList.map((r) => r.track_id)

    const { data: allTh } =
      trackIds.length > 0
        ? await admin
            .from('health_challenge_level_thresholds')
            .select('track_id, level, target_value')
            .in('track_id', trackIds)
            .is('deleted_at', null)
        : { data: [] as { track_id: string; level: number; target_value: number }[] }

    const thMap = new Map<string, Map<number, number>>()
    for (const r of allTh ?? []) {
      if (!thMap.has(r.track_id)) thMap.set(r.track_id, new Map())
      thMap.get(r.track_id)!.set(r.level, Number(r.target_value))
    }

    const kinds: Array<'WALK' | 'RUN' | 'HIKE' | 'RIDE'> = ['WALK', 'RUN', 'HIKE', 'RIDE']
    const tracks: LinkedHealthSeasonEditorTrackRow[] = []

    for (const kind of kinds) {
      const seed = DEFAULT_HEALTH_TRACK_SEEDS.find((s) => s.kind === kind)!
      const row = trackList.find((t) => t.kind === kind)
      if (!row) {
        tracks.push({
          track_id: null,
          kind,
          title: seed.title,
          metric: seed.metric,
          sort_order: seed.sort_order,
          min_distance_km: seed.min_distance_km,
          min_speed_kmh: seed.min_speed_kmh,
          min_elevation_m: seed.min_elevation_m,
          level1: seed.level_targets[0],
          level2: seed.level_targets[1],
          level3: seed.level_targets[2],
        })
        continue
      }
      const m = thMap.get(row.track_id)
      const g = (lv: number, fb: number) => (m?.has(lv) ? m.get(lv)! : fb)
      tracks.push({
        track_id: row.track_id,
        kind,
        title: row.title,
        metric: row.metric as LinkedHealthSeasonEditorTrackRow['metric'],
        sort_order: row.sort_order,
        min_distance_km: row.min_distance_km != null ? Number(row.min_distance_km) : null,
        min_speed_kmh: row.min_speed_kmh != null ? Number(row.min_speed_kmh) : null,
        min_elevation_m: row.min_elevation_m != null ? Number(row.min_elevation_m) : null,
        level1: g(1, seed.level_targets[0]),
        level2: g(2, seed.level_targets[1]),
        level3: g(3, seed.level_targets[2]),
      })
    }

    return {
      data: {
        season_id: season.season_id,
        name: season.name,
        slug: season.slug,
        status: season.status as LinkedHealthSeasonEditorData['status'],
        startDate: seoulYmdFromIso(season.starts_at),
        endDate: seoulYmdFromIso(season.ends_at),
        criteria_attachment_url: (season as { criteria_attachment_url?: string | null }).criteria_attachment_url ?? null,
        tracks,
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '건강 시즌 조회 실패' }
  }
}

export type SaveLinkedHealthSeasonInput = {
  seasonName: string
  startDate: string
  endDate: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  /** 비우면 null 저장 (기준표 제거) */
  criteriaAttachmentUrl: string | null
  tracks: HealthSeasonTracksPayload
}

/** 이벤트 수정 화면에서 시즌 기간·상태·4종목 1회 조건·월 누적 L1~L3 저장 */
export async function updateLinkedHealthSeasonRules(
  eventId: string,
  input: SaveLinkedHealthSeasonInput
): Promise<{ success: boolean; error: string | null }> {
  const gate = await assertIsAdmin()
  if ('error' in gate) return { success: false, error: gate.error }

  const name = input.seasonName.trim()
  if (!name) return { success: false, error: '시즌 이름을 입력하세요.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
    return { success: false, error: '기간은 YYYY-MM-DD 형식이어야 합니다.' }
  }
  if (input.startDate > input.endDate) {
    return { success: false, error: '종료일이 시작일보다 빠를 수 없습니다.' }
  }

  const trackErr = validateHealthTracksPayload(input.tracks)
  if (trackErr) return { success: false, error: trackErr }

  try {
    const admin = createAdminClient()
    const seasonQuery = await admin
      .from('health_challenge_seasons')
      .select('season_id')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .maybeSingle()
    if (seasonQuery.error && isMissingEventIdColumnError(seasonQuery.error.message)) {
      return { success: false, error: 'DB에 event_id 컬럼이 없습니다. 034 마이그레이션을 먼저 적용하세요.' }
    }
    const season = seasonQuery.data

    if (!season) {
      return { success: false, error: '이 이벤트에 연결된 건강 챌린지 시즌이 없습니다. 먼저 시즌을 만드세요.' }
    }

    if (input.status === 'ACTIVE') {
      await admin
        .from('health_challenge_seasons')
        .update({ status: 'ARCHIVED' })
        .eq('status', 'ACTIVE')
        .neq('season_id', season.season_id)
        .is('deleted_at', null)
    }

    let uSeason: { message?: string } | null = null
    const criteriaUrl = input.criteriaAttachmentUrl?.trim() || null
    const withCriteria = await admin
      .from('health_challenge_seasons')
      .update({
        name,
        starts_at: `${input.startDate}T00:00:00+09:00`,
        ends_at: `${input.endDate}T23:59:59.999+09:00`,
        status: input.status,
        criteria_attachment_url: criteriaUrl,
      })
      .eq('season_id', season.season_id)
      .is('deleted_at', null)
    uSeason = withCriteria.error

    if (uSeason && isMissingCriteriaAttachmentColumnError(uSeason.message)) {
      const fallback = await admin
        .from('health_challenge_seasons')
        .update({
          name,
          starts_at: `${input.startDate}T00:00:00+09:00`,
          ends_at: `${input.endDate}T23:59:59.999+09:00`,
          status: input.status,
        })
        .eq('season_id', season.season_id)
        .is('deleted_at', null)
      uSeason = fallback.error
    }

    if (uSeason) return { success: false, error: uSeason.message ?? '시즌 저장 실패' }

    const applied = await upsertHealthTracksForSeason(season.season_id, input.tracks)
    if (!applied.success) return { success: false, error: applied.error }

    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath('/admin/health-challenges')
    revalidatePath('/admin/events')
    revalidatePath('/')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '저장 실패' }
  }
}
