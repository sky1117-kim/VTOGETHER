'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getTotalDonationStats } from '@/api/queries/donation'

const SITE_CONTENT_KEYS = ['hero_season_badge', 'hero_title', 'hero_subtitle'] as const
export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number]

export type UserRow = {
  user_id: string
  email: string
  name: string | null
  dept_name: string | null
  current_points: number
  total_donated_amount: number
  level: string
  is_admin: boolean
  /** MAU 집계용: 최근 30일 내 접속 시 갱신됨 (016 마이그레이션) */
  last_active_at: string | null
}

export async function getUsersForAdmin(): Promise<{ data: UserRow[] | null; error: string | null }> {
  try {
    const supabase = createAdminClient()
    let selectColumns = 'user_id, email, name, dept_name, current_points, total_donated_amount, level, is_admin, last_active_at'
    let { data, error } = await supabase
      .from('users')
      .select(selectColumns)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    // last_active_at 컬럼 없음(016 미실행) 시 제외하고 재시도
    if (error?.message?.includes('last_active_at')) {
      selectColumns = 'user_id, email, name, dept_name, current_points, total_donated_amount, level, is_admin'
      const retry = await supabase.from('users').select(selectColumns).is('deleted_at', null).order('created_at', { ascending: false })
      data = retry.data
      error = retry.error
      if (!error && data) {
        return {
          data: (data ?? []).map((r) => {
            const row = r as unknown as Record<string, unknown>
            return { ...row, is_admin: !!(row.is_admin as boolean), last_active_at: null } as UserRow
          }),
          error: null,
        }
      }
    }
    if (error) {
      // is_admin 컬럼이 없을 때(006-1 미실행) 컬럼 제외하고 다시 시도
      if (error.message?.includes('is_admin') || error.message?.includes('column')) {
        const { data: dataFallback, error: err2 } = await supabase
          .from('users')
          .select('user_id, email, name, dept_name, current_points, total_donated_amount, level')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (err2) return { data: null, error: err2.message }
        return {
          data: (dataFallback ?? []).map((r) => {
            const row = r as unknown as Record<string, unknown>
            return { ...row, is_admin: false, last_active_at: null } as UserRow
          }),
          error: null,
        }
      }
      return { data: null, error: error.message }
    }
    return {
      data: (data ?? []).map((r) => {
        const row = r as unknown as Record<string, unknown>
        return { ...row, is_admin: !!(row.is_admin as boolean), last_active_at: (row.last_active_at as string | null) ?? null } as UserRow
      }),
      error: null,
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to fetch users' }
  }
}

/** 최근 접속한 사용자 목록 (last_active_at 기준 내림차순, 관리자용) */
export async function getRecentActiveUsersForAdmin(): Promise<{
  data: UserRow[] | null
  error: string | null
}> {
  const result = await getUsersForAdmin()
  if (result.error || !result.data) return result
  const sorted = [...result.data].sort((a, b) => {
    const aAt = a.last_active_at ?? ''
    const bAt = b.last_active_at ?? ''
    if (!aAt && !bAt) return 0
    if (!aAt) return 1
    if (!bAt) return -1
    return bAt.localeCompare(aAt)
  })
  return { data: sorted, error: null }
}

export async function grantPoints(
  userId: string,
  amount: number,
  reason?: string | null
): Promise<{ success: boolean; error: string | null }> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    return { success: false, error: '1 이상의 정수만 입력해주세요.' }
  }
  try {
    const supabase = createAdminClient()
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('current_points, name, email')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single()
    if (fetchError || !user) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' }
    }
    const newPoints = (user.current_points ?? 0) + amount
    const { error: updateError } = await supabase
      .from('users')
      .update({ current_points: newPoints })
      .eq('user_id', userId)
    if (updateError) {
      return { success: false, error: updateError.message }
    }
    const description = reason?.trim() || '관리자 지급'
    const { error: txError } = await supabase.from('point_transactions').insert({
      user_id: userId,
      type: 'EARNED',
      amount,
      related_id: null,
      related_type: 'ADMIN_GRANT',
      description,
      user_email: user.email ?? null,
      user_name: user.name ?? null,
    })
    if (txError) {
      return { success: false, error: '거래 기록 실패: ' + txError.message }
    }
    revalidatePath('/admin')
    revalidatePath('/')
    revalidatePath('/donation')
    revalidatePath('/my')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '포인트 지급 실패' }
  }
}

/** 관리자 여부 설정 (관리자만 호출 가능) */
export async function updateUserAdmin(
  userId: string,
  isAdmin: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return { success: false, error: '로그인이 필요합니다.' }

    const supabase = createAdminClient()
    const { data: me, error: meError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()
    if (meError || !me?.is_admin) {
      return { success: false, error: '관리자만 설정할 수 있습니다.' }
    }

    const { error } = await supabase
      .from('users')
      .update({ is_admin: isAdmin })
      .eq('user_id', userId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    revalidatePath('/')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '설정 저장 실패' }
  }
}

/** 사용자 부서 수정 (관리자) — Google 로그인은 부서 정보를 주지 않아 수동 입력용 */
export async function updateUserDept(
  userId: string,
  deptName: string | null
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('users')
      .update({ dept_name: deptName?.trim() || null })
      .eq('user_id', userId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    revalidatePath('/')
    revalidatePath('/my')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '부서 저장 실패' }
  }
}

/** 관리자 대시보드용 지표: 전사 기부 통계 + 진행 중 이벤트 수 + 승인 대기 건수 + MAU */
export async function getAdminDashboardStats(): Promise<{
  totalCurrent: number
  totalTarget: number
  progress: number
  completedCount: number
  activeEventsCount: number
  pendingCount: number
  mau: number | null
  error: string | null
}> {
  try {
    const donation = await getTotalDonationStats()
    let pendingCount = 0
    let activeEventsCount = 0
    let mau: number | null = null
    try {
      const supabase = createAdminClient()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const iso = thirtyDaysAgo.toISOString()

      const [pendingRes, eventsRes, mauRes] = await Promise.all([
        supabase.from('event_submissions').select('*', { count: 'exact', head: true }).eq('status', 'PENDING').is('deleted_at', null),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').is('deleted_at', null),
        supabase.from('users').select('user_id', { count: 'exact', head: true }).gte('last_active_at', iso).is('deleted_at', null),
      ])
      if (!pendingRes.error) pendingCount = pendingRes.count ?? 0
      if (!eventsRes.error) activeEventsCount = eventsRes.count ?? 0
      if (!mauRes.error) mau = mauRes.count ?? 0
    } catch {
      // 테이블/컬럼 없거나 RLS 등으로 실패 시 숫자는 0, mau는 null(준비 중)
    }
    return {
      totalCurrent: donation.totalCurrent,
      totalTarget: donation.totalTarget,
      progress: donation.progress,
      completedCount: donation.completedCount,
      activeEventsCount,
      pendingCount,
      mau,
      error: null,
    }
  } catch (e) {
    return {
      totalCurrent: 0,
      totalTarget: 0,
      progress: 0,
      completedCount: 0,
      activeEventsCount: 0,
      pendingCount: 0,
      mau: null,
      error: e instanceof Error ? e.message : '지표 조회 실패',
    }
  }
}

/** 오늘 / 이번 주 / 이번 달 기부 금액 (관리자 대시보드 시각화용). UTC 기준. */
export async function getDonationAmountsByPeriod(): Promise<{
  today: number
  thisWeek: number
  thisMonth: number
  error: string | null
}> {
  try {
    const now = new Date()
    const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const startWeek = new Date(now)
    const dow = now.getUTCDay()
    const toMonday = dow === 0 ? 6 : dow - 1
    startWeek.setUTCDate(now.getUTCDate() - toMonday)
    startWeek.setUTCHours(0, 0, 0, 0)
    const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const supabase = createAdminClient()
    const { data: rows, error } = await supabase
      .from('donations')
      .select('amount, created_at')
      .is('deleted_at', null)
      .gte('created_at', startMonth.toISOString())

    if (error) return { today: 0, thisWeek: 0, thisMonth: 0, error: error.message }

    const isoToday = startToday.toISOString()
    const isoWeek = startWeek.toISOString()

    let today = 0
    let thisWeek = 0
    let thisMonth = 0
    for (const r of rows ?? []) {
      const amt = Number((r as { amount: number }).amount) || 0
      const at = (r as { created_at: string }).created_at
      thisMonth += amt
      if (at >= isoWeek) thisWeek += amt
      if (at >= isoToday) today += amt
    }

    return { today, thisWeek, thisMonth, error: null }
  } catch (e) {
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      error: e instanceof Error ? e.message : '기간별 기부 조회 실패',
    }
  }
}

/** 이벤트 적립 현황: Culture/V.Together별 V.Point, 매칭금 (Culture만 매칭 대상) */
export async function getEventEarnedStats(): Promise<{
  cultureEarned: number
  vTogetherEarned: number
  matchingAmount: number
  totalEarned: number
  totalCollected: number
  error: string | null
}> {
  const empty = { cultureEarned: 0, vTogetherEarned: 0, matchingAmount: 0, totalEarned: 0, totalCollected: 0, error: null as string | null }
  try {
    const supabase = createAdminClient()
    const { data: txRows, error: txErr } = await supabase
      .from('point_transactions')
      .select('amount, related_id')
      .eq('type', 'EARNED')
      .eq('related_type', 'EVENT')
      .is('deleted_at', null)
    if (txErr) return { ...empty, error: txErr.message }
    const txs = txRows ?? []
    if (txs.length === 0) return empty

    const submissionIds = [...new Set(txs.map((t) => (t as { related_id: string }).related_id).filter(Boolean))]
    const { data: subs } = await supabase
      .from('event_submissions')
      .select('submission_id, event_id')
      .in('submission_id', submissionIds)
      .is('deleted_at', null)
    const subToEvent = new Map((subs ?? []).map((s) => [(s as { submission_id: string }).submission_id, (s as { event_id: string }).event_id]))
    const eventIds = [...new Set(subToEvent.values())]
    const { data: evRows } = await supabase
      .from('events')
      .select('event_id, category')
      .in('event_id', eventIds)
      .is('deleted_at', null)
    const eventToCategory = new Map((evRows ?? []).map((e) => [(e as { event_id: string }).event_id, (e as { category: string }).category]))

    let cultureEarned = 0
    let vTogetherEarned = 0
    for (const t of txs) {
      const subId = (t as { related_id: string }).related_id
      const amount = Number((t as { amount: number }).amount) || 0
      const eventId = subId ? subToEvent.get(subId) : null
      const category = eventId ? eventToCategory.get(eventId) : null
      if (category === 'CULTURE') cultureEarned += amount
      else if (category === 'V_TOGETHER') vTogetherEarned += amount
    }
    const matchingAmount = cultureEarned
    const totalCollected = vTogetherEarned + cultureEarned + matchingAmount
    return {
      cultureEarned,
      vTogetherEarned,
      matchingAmount,
      totalEarned: cultureEarned + vTogetherEarned,
      totalCollected,
      error: null,
    }
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : '이벤트 적립 현황 조회 실패' }
  }
}

/** 쿠폰/굿즈 등 비포인트 보상 선택 건 — 관리자가 별도 발송 챙길 대상 목록 */
export type NonPointRewardRow = {
  submission_id: string
  event_id: string
  event_title: string
  user_id: string
  user_name: string | null
  user_email: string | null
  round_number: number | null
  reward_type: string
  chosen_at: string
  /** 발송 완료 시각. null이면 미발송 */
  fulfilled_at: string | null
}

/** 필터: 전체 | 미발송 | 발송완료 */
export type RewardFulfillmentFilter = 'all' | 'pending' | 'fulfilled'

/** 쿠폰/굿즈 발송 대상이 있는 이벤트 목록 (필터 드롭다운용) */
export async function getEventsForRewardFulfillment(): Promise<{
  data: { event_id: string; title: string }[] | null
  error: string | null
}> {
  try {
    const supabase = createAdminClient()
    const { data: subs } = await supabase
      .from('event_submissions')
      .select('event_id')
      .eq('status', 'APPROVED')
      .is('deleted_at', null)
      .eq('reward_received', true)
      .in('reward_type', ['COFFEE_COUPON', 'GOODS', 'COUPON'])
    const eventIds = [...new Set((subs ?? []).map((s) => s.event_id))]
    if (eventIds.length === 0) return { data: [], error: null }
    const { data: events, error } = await supabase
      .from('events')
      .select('event_id, title')
      .in('event_id', eventIds)
      .is('deleted_at', null)
      .order('title', { ascending: true })
    if (error) return { data: null, error: error.message }
    return { data: (events ?? []) as { event_id: string; title: string }[], error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '이벤트 목록 조회 실패' }
  }
}

export async function getNonPointRewardFulfillmentList(
  filter: RewardFulfillmentFilter = 'all',
  eventId?: string | null
): Promise<{
  data: NonPointRewardRow[] | null
  error: string | null
}> {
  try {
    const supabase = createAdminClient()
    let query = supabase
      .from('event_submissions')
      .select('submission_id, event_id, round_id, user_id, reward_type, updated_at, non_point_fulfilled_at')
      .eq('status', 'APPROVED')
      .is('deleted_at', null)
      .eq('reward_received', true)
      .in('reward_type', ['COFFEE_COUPON', 'GOODS', 'COUPON'])
      .order('updated_at', { ascending: false })

    if (filter === 'pending') query = query.is('non_point_fulfilled_at', null)
    if (filter === 'fulfilled') query = query.not('non_point_fulfilled_at', 'is', null)
    if (eventId?.trim()) query = query.eq('event_id', eventId.trim())

    const { data: subs, error: subErr } = await query

    let subsResult: typeof subs = subs ?? []
    if (subErr) {
      // 마이그레이션 017 미실행 시: non_point_fulfilled_at 컬럼 없으면 전체만 조회로 재시도
      const isColumnMissing = /non_point_fulfilled_at/.test(subErr.message ?? '')
      if (!isColumnMissing) return { data: null, error: subErr.message }
      let fallbackQuery = supabase
        .from('event_submissions')
        .select('submission_id, event_id, round_id, user_id, reward_type, updated_at')
        .eq('status', 'APPROVED')
        .is('deleted_at', null)
        .eq('reward_received', true)
        .in('reward_type', ['COFFEE_COUPON', 'GOODS', 'COUPON'])
        .order('updated_at', { ascending: false })
      if (eventId?.trim()) fallbackQuery = fallbackQuery.eq('event_id', eventId.trim())
      const { data: subsFallback, error: subErr2 } = await fallbackQuery
      if (subErr2) return { data: null, error: subErr2.message }
      subsResult = (subsFallback ?? []).map((s) => ({ ...s, non_point_fulfilled_at: null }))
    }

    if (!subsResult.length) return { data: [], error: null }

    const eventIds = [...new Set(subsResult.map((s) => s.event_id))]
    const userIds = [...new Set(subsResult.map((s) => s.user_id))]
    const roundIds = subsResult.map((s) => s.round_id).filter(Boolean) as string[]

    const [eventsRes, usersRes, roundsRes] = await Promise.all([
      supabase.from('events').select('event_id, title').in('event_id', eventIds).is('deleted_at', null),
      supabase.from('users').select('user_id, name, email').in('user_id', userIds).is('deleted_at', null),
      roundIds.length ? supabase.from('event_rounds').select('round_id, round_number').in('round_id', roundIds).is('deleted_at', null) : { data: [] },
    ])

    const eventMap = new Map((eventsRes.data ?? []).map((e) => [e.event_id, e]))
    const userMap = new Map((usersRes.data ?? []).map((u) => [u.user_id, u]))
    const roundMap = new Map((roundsRes.data ?? []).map((r) => [r.round_id, r]))

    const data: NonPointRewardRow[] = subsResult.map((s) => {
      const event = eventMap.get(s.event_id)
      const user = userMap.get(s.user_id)
      const round = s.round_id ? roundMap.get(s.round_id) : null
      const row = s as { non_point_fulfilled_at?: string | null }
      return {
        submission_id: s.submission_id,
        event_id: s.event_id,
        event_title: event?.title ?? '—',
        user_id: s.user_id,
        user_name: user?.name ?? null,
        user_email: user?.email ?? null,
        round_number: round?.round_number ?? null,
        reward_type: s.reward_type ?? '—',
        chosen_at: s.updated_at,
        fulfilled_at: row.non_point_fulfilled_at ?? null,
      }
    })
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : '목록 조회 실패' }
  }
}

/** 쿠폰/굿즈 발송 완료 체크 토글 (관리자 전용) */
export async function setRewardFulfillment(
  submissionId: string,
  fulfilled: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('event_submissions')
      .update({
        non_point_fulfilled_at: fulfilled ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('submission_id', submissionId)
      .in('reward_type', ['COFFEE_COUPON', 'GOODS', 'COUPON'])
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/reward-fulfillment')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '저장 실패' }
  }
}

export async function getSiteContentForAdmin(): Promise<Record<string, string>> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('site_content').select('key, value').is('deleted_at', null)
  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.key] = row.value ?? ''
  }
  return map
}

export async function updateSiteContent(
  key: SiteContentKey,
  value: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('site_content')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) return { success: false, error: error.message }
    revalidatePath('/')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '저장 실패' }
  }
}

/** 기존 데이터 정리 후 테스트용 데이터로 채움 (포인트 지급·기부·랭킹 확인용) */
export async function resetAndSeedTestData(): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createAdminClient()

    const now = new Date().toISOString()
    const { error: delTx } = await supabase.from('point_transactions').update({ deleted_at: now }).is('deleted_at', null)
    const { error: delDon } = await supabase.from('donations').update({ deleted_at: now }).is('deleted_at', null)
    if (delTx || delDon) {
      return { success: false, error: '데이터 삭제 실패. RLS 정책을 확인하세요.' }
    }
    await supabase.from('donation_targets').update({ current_amount: 0, status: 'ACTIVE' })
    await supabase.from('users').update({ current_points: 0, total_donated_amount: 0 })

    await supabase.from('site_content').upsert(
      [
        { key: 'hero_season_badge', value: '2026 Season 1' },
        { key: 'hero_title', value: '나의 활동이\n세상의 기회가 되도록' },
        { key: 'hero_subtitle', value: '획득한 V.Point로 기부하고\n나의 ESG Level을 올려보세요!' },
      ],
      { onConflict: 'key' }
    )

    const testUsers = [
      { user_id: 'test-user-1', email: 'test1@vntg.co.kr', name: '테스트유저1', dept_name: 'DT팀', current_points: 10000, total_donated_amount: 52000 },
      { user_id: 'test-user-2', email: 'test2@vntg.co.kr', name: '테스트유저2', dept_name: 'HR팀', current_points: 5000, total_donated_amount: 45000 },
      { user_id: 'test-user-3', email: 'test3@vntg.co.kr', name: '테스트유저3', dept_name: '영업2팀', current_points: 3000, total_donated_amount: 38000 },
      { user_id: 'test-user-4', email: 'test4@vntg.co.kr', name: '테스트유저4', dept_name: '기획팀', current_points: 0, total_donated_amount: 35000 },
      { user_id: 'test-user-5', email: 'test5@vntg.co.kr', name: '테스트유저5', dept_name: 'DT팀', current_points: 0, total_donated_amount: 32000 },
    ]
    await supabase.from('users').upsert(testUsers, { onConflict: 'user_id' })

    const { data: targets } = await supabase.from('donation_targets').select('target_id').is('deleted_at', null).limit(4)
    if (targets?.length) {
      await supabase.from('donation_targets').update({ current_amount: 1200000 }).eq('target_id', targets[0].target_id)
      if (targets[1]) await supabase.from('donation_targets').update({ current_amount: 2400000 }).eq('target_id', targets[1].target_id)
      if (targets[2]) await supabase.from('donation_targets').update({ current_amount: 500000 }).eq('target_id', targets[2].target_id)
    }

    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/donation')
    revalidatePath('/my')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '초기화 실패' }
  }
}
