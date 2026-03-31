import {
  HEALTH_CHALLENGE_MAX_MONTHLY_MEDALS,
  HEALTH_CHALLENGE_MEDAL_PER_LEVEL_POINT,
} from '@/constants/health-challenges'

export type HealthMetric = 'DISTANCE_KM' | 'ELEVATION_M'

export type HealthTrackRule = {
  metric: HealthMetric
  min_distance_km: number | null
  min_speed_kmh: number | null
  min_elevation_m: number | null
}

export type HealthLogInput = {
  distance_km: number | null
  speed_kmh: number | null
  elevation_m: number | null
}

/** 제출 활동값의 기본 유효성만 확인 (달성 판정은 월 누적으로 계산) */
export function validateSessionForTrack(track: HealthTrackRule, log: HealthLogInput): { ok: true } | { ok: false; message: string } {
  const d = log.distance_km
  const e = log.elevation_m

  if (track.metric === 'DISTANCE_KM') {
    if (d == null || Number.isNaN(d) || d <= 0) {
      return { ok: false, message: '거리(km)를 입력하세요.' }
    }
    return { ok: true }
  }

  // ELEVATION_M (하이킹)
  if (e == null || Number.isNaN(e) || e <= 0) {
    return { ok: false, message: '활동 고도(m)를 입력하세요.' }
  }
  return { ok: true }
}

/** 승인 시 월 누적에 더할 값 (거리 km 또는 고도 m) */
export function contributedValueForApprovedLog(track: HealthTrackRule, log: HealthLogInput): number {
  if (track.metric === 'DISTANCE_KM') {
    return Number(log.distance_km ?? 0)
  }
  return Number(log.elevation_m ?? 0)
}

/** 임계값 오름차순(level 1,2,3)으로 달성 레벨 0~3 */
export function achievedLevelFromTotal(
  total: number,
  thresholds: Array<{ level: number; target_value: number }>
): number {
  const sorted = [...thresholds].sort((a, b) => a.level - b.level)
  let level = 0
  for (const t of sorted) {
    if (total >= Number(t.target_value)) level = t.level
  }
  return level
}

/** 종목별 달성 레벨 합 → V.Medal (기본: 1레벨=1M, 상한 12) */
export function medalsFromLevelSum(
  levelSum: number,
  policy?: { perLevelMedals?: number; maxMonthlyMedals?: number }
): number {
  const perLevel = Math.max(0, Number(policy?.perLevelMedals ?? HEALTH_CHALLENGE_MEDAL_PER_LEVEL_POINT))
  const maxMonthly = Math.max(0, Number(policy?.maxMonthlyMedals ?? HEALTH_CHALLENGE_MAX_MONTHLY_MEDALS))
  const raw = levelSum * perLevel
  return Math.min(maxMonthly, Math.max(0, raw))
}
