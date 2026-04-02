'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateSessionForTrack, type HealthTrackRule } from '@/lib/health-challenge-scoring'
import { isActivityDateInSeasonRange, yearMonthFromISODate } from '@/lib/health-challenge-time'
import { HEALTH_CHALLENGE_MIN_PHOTOS_PER_ENTRY } from '@/constants/health-challenges'
import { sendGoogleChatAdminAlert } from '@/lib/google-chat-alert'

export type HealthActivityEntryInput = {
  track_id: string
  activity_date: string
  distance_km?: number | null
  speed_kmh?: number | null
  elevation_m?: number | null
  photo_urls: string[]
}

/** 여러 건 한 번에 제출 (각 건은 별도 로그 행) */
export async function submitHealthActivityLogsBatch(
  entries: HealthActivityEntryInput[]
): Promise<{ success: boolean; submitted: number; error: string | null }> {
  if (!entries.length) {
    return { success: false, submitted: 0, error: '제출할 인증을 추가하세요.' }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return { success: false, submitted: 0, error: '로그인이 필요합니다.' }

    const { data: season, error: sErr } = await supabase
      .from('health_challenge_seasons')
      .select('season_id, name, starts_at, ends_at')
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (sErr || !season) {
      return { success: false, submitted: 0, error: '진행 중인 건강 챌린지가 없습니다.' }
    }

    // 같은 배치에서 여러 활동을 한 번에 제출하므로 entries의 연/월은 통일합니다.
    const firstYm = yearMonthFromISODate(entries[0]?.activity_date ?? '')
    if (!firstYm) {
      return { success: false, submitted: 0, error: '활동일(YYYY-MM-DD)을 확인하세요.' }
    }
    const { year, month } = firstYm
    for (let i = 0; i < entries.length; i++) {
      const ym = yearMonthFromISODate(entries[i]?.activity_date ?? '')
      if (!ym || ym.year !== year || ym.month !== month) {
        return {
          success: false,
          submitted: 0,
          error: '한 번의 제출에는 같은 연/월의 활동만 넣을 수 있습니다.',
        }
      }
    }

    const pad2 = (n: number) => String(n).padStart(2, '0')
    const monthStartYmd = `${year}-${pad2(month)}-01`
    const monthLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const monthEndYmd = `${year}-${pad2(month)}-${pad2(monthLastDay)}`

    const trackIds = [...new Set(entries.map((e) => e.track_id))]
    const { data: existingRows, error: existingErr } = await supabase
      .from('health_challenge_activity_logs')
      .select('track_id, activity_date')
      .eq('season_id', season.season_id)
      .eq('user_id', user.id)
      .in('status', ['PENDING', 'APPROVED'])
      .is('deleted_at', null)
      .gte('activity_date', monthStartYmd)
      .lte('activity_date', monthEndYmd)
      .in('track_id', trackIds)

    if (existingErr) {
      return { success: false, submitted: 0, error: existingErr.message }
    }
    // 같은 달이라도 "같은 종목 + 같은 활동일"만 중복 차단합니다.
    const existingTrackDateKeys = new Set(
      (existingRows ?? []).map((r) => `${r.track_id}::${r.activity_date}`)
    )

    const { data: tracks, error: tErr } = await supabase
      .from('health_challenge_tracks')
      .select('track_id, season_id, metric, min_distance_km, min_speed_kmh, min_elevation_m')
      .in('track_id', trackIds)
      .eq('season_id', season.season_id)
      .is('deleted_at', null)

    if (tErr || !tracks?.length) {
      return { success: false, submitted: 0, error: '종목 정보를 찾을 수 없습니다.' }
    }

    const trackMap = new Map(
      tracks.map((t) => [
        t.track_id,
        {
          metric: t.metric as HealthTrackRule['metric'],
          min_distance_km: t.min_distance_km != null ? Number(t.min_distance_km) : null,
          min_speed_kmh: t.min_speed_kmh != null ? Number(t.min_speed_kmh) : null,
          min_elevation_m: t.min_elevation_m != null ? Number(t.min_elevation_m) : null,
        } satisfies HealthTrackRule,
      ])
    )

    const rows: Array<{
      season_id: string
      track_id: string
      user_id: string
      activity_date: string
      distance_km: number | null
      speed_kmh: number | null
      elevation_m: number | null
      photo_urls: string[]
      status: 'PENDING'
    }> = []

    const payloadTrackDateKeys = new Set<string>()
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const photos = (e.photo_urls ?? []).filter((u) => typeof u === 'string' && u.trim())
      if (photos.length < HEALTH_CHALLENGE_MIN_PHOTOS_PER_ENTRY) {
        return { success: false, submitted: 0, error: `${i + 1}번째 인증: 사진을 ${HEALTH_CHALLENGE_MIN_PHOTOS_PER_ENTRY}장 이상 첨부하세요.` }
      }

      const ad = e.activity_date?.trim()
      if (!ad || !/^\d{4}-\d{2}-\d{2}$/.test(ad)) {
        return { success: false, submitted: 0, error: `${i + 1}번째 인증: 활동일(YYYY-MM-DD)을 입력하세요.` }
      }

      if (!isActivityDateInSeasonRange(ad, season.starts_at, season.ends_at)) {
        return { success: false, submitted: 0, error: `${i + 1}번째 인증: 활동일이 챌린지 기간 안이 아닙니다.` }
      }
      const trackDateKey = `${e.track_id}::${ad}`
      if (existingTrackDateKeys.has(trackDateKey)) {
        return {
          success: false,
          submitted: 0,
          error: `${i + 1}번째 인증: 같은 종목·같은 활동일은 이미 제출되어 있습니다.`,
        }
      }
      if (payloadTrackDateKeys.has(trackDateKey)) {
        return {
          success: false,
          submitted: 0,
          error: `${i + 1}번째 인증: 같은 종목·같은 활동일이 중복되어 있습니다.`,
        }
      }
      payloadTrackDateKeys.add(trackDateKey)

      const rule = trackMap.get(e.track_id)
      if (!rule) {
        return { success: false, submitted: 0, error: `${i + 1}번째 인증: 종목을 찾을 수 없습니다.` }
      }

      const logInput = {
        distance_km: e.distance_km != null ? Number(e.distance_km) : null,
        speed_kmh: e.speed_kmh != null ? Number(e.speed_kmh) : null,
        elevation_m: e.elevation_m != null ? Number(e.elevation_m) : null,
      }

      const v = validateSessionForTrack(rule, logInput)
      if (!v.ok) {
        return { success: false, submitted: 0, error: `${i + 1}번째 인증 (${v.message})` }
      }

      rows.push({
        season_id: season.season_id,
        track_id: e.track_id,
        user_id: user.id,
        activity_date: ad,
        distance_km: logInput.distance_km,
        speed_kmh: logInput.speed_kmh,
        elevation_m: logInput.elevation_m,
        photo_urls: photos,
        status: 'PENDING',
      })
    }

    const { error: insErr } = await supabase.from('health_challenge_activity_logs').insert(rows)
    if (insErr) {
      if (
        insErr.code === '23505' &&
        (insErr.message.includes('uq_health_logs_user_track_activity_active') ||
          insErr.message.includes('health_challenge_activity_logs'))
      ) {
        return {
          success: false,
          submitted: 0,
          error: '같은 종목·같은 활동일은 이미 제출되어 있습니다.',
        }
      }
      return { success: false, submitted: 0, error: insErr.message }
    }

    // 이벤트 인증과 동일하게, 승인 대기 건 생성 시 관리자 Google Chat(스페이스 웹훅) 알림
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_DEV_APP_URL?.trim() ||
      'http://localhost:3000'
    const adminVerificationLink = `${appUrl.replace(/\/+$/, '')}/admin/verifications`
    await sendGoogleChatAdminAlert({
      title: '새 건강 챌린지 인증(승인 대기)',
      userId: user.id,
      userEmail: user.email ?? undefined,
      userName:
        (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
        (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
        undefined,
      message: [
        `시즌: ${season.name ?? '이름 없음'}`,
        `제출 건수: ${rows.length}건`,
        `제출자 ID: ${user.id}`,
        `제출자 이메일: ${user.email ?? '알 수 없음'}`,
        `확인 링크: ${adminVerificationLink}`,
      ].join('\n'),
    })

    revalidatePath('/')
    revalidatePath('/my')
    return { success: true, submitted: rows.length, error: null }
  } catch (e) {
    return {
      success: false,
      submitted: 0,
      error: e instanceof Error ? e.message : '제출 중 오류가 발생했습니다.',
    }
  }
}
