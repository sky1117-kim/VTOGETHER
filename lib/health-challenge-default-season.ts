/**
 * 새 시즌 생성 시 자동으로 넣는 4종목 + L1~L3 목표(기획표 기준).
 * 관리자 `/admin/health-challenges`에서 시즌을 열 때 동일 규격이 적용됩니다.
 */

export type DefaultTrackSeed = {
  kind: 'WALK' | 'RUN' | 'HIKE' | 'RIDE'
  title: string
  sort_order: number
  metric: 'DISTANCE_KM' | 'ELEVATION_M'
  min_distance_km: number | null
  min_speed_kmh: number | null
  min_elevation_m: number | null
  /** L1, L2, L3 월 누적 목표값 (km 또는 m) */
  level_targets: [number, number, number]
}

export const DEFAULT_HEALTH_TRACK_SEEDS: DefaultTrackSeed[] = [
  {
    kind: 'WALK',
    title: '걷기',
    sort_order: 1,
    metric: 'DISTANCE_KM',
    min_distance_km: 2,
    min_speed_kmh: null,
    min_elevation_m: null,
    level_targets: [40, 50, 60],
  },
  {
    kind: 'RUN',
    title: '러닝',
    sort_order: 2,
    metric: 'DISTANCE_KM',
    min_distance_km: 5,
    min_speed_kmh: 6,
    min_elevation_m: null,
    level_targets: [20, 25, 30],
  },
  {
    kind: 'HIKE',
    title: '하이킹',
    sort_order: 3,
    metric: 'ELEVATION_M',
    min_distance_km: null,
    min_speed_kmh: null,
    min_elevation_m: 100,
    level_targets: [400, 600, 800],
  },
  {
    kind: 'RIDE',
    title: '라이딩',
    sort_order: 4,
    metric: 'DISTANCE_KM',
    min_distance_km: 10,
    min_speed_kmh: 12,
    min_elevation_m: null,
    level_targets: [40, 50, 60],
  },
]

/** URL·유니크용 slug (영문·숫자·하이픈; 비우면 타임스탬프) */
export function slugifyHealthSeasonSlug(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s || `season-${Date.now()}`
}
