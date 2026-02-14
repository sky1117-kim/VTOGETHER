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
}

export async function getUsersForAdmin(): Promise<{ data: UserRow[] | null; error: string | null }> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('users')
      .select('user_id, email, name, dept_name, current_points, total_donated_amount, level, is_admin')
      .order('created_at', { ascending: false })
    if (error) {
      // is_admin 컬럼이 없을 때(006-1 미실행) 컬럼 제외하고 다시 시도
      if (error.message?.includes('is_admin') || error.message?.includes('column')) {
        const { data: dataFallback, error: err2 } = await supabase
          .from('users')
          .select('user_id, email, name, dept_name, current_points, total_donated_amount, level')
          .order('created_at', { ascending: false })
        if (err2) return { data: null, error: err2.message }
        return {
          data: (dataFallback ?? []).map((r) => ({ ...r, is_admin: false })) as UserRow[],
          error: null,
        }
      }
      return { data: null, error: error.message }
    }
    return {
      data: (data ?? []).map((r) => ({ ...r, is_admin: !!(r as { is_admin?: boolean }).is_admin })) as UserRow[],
      error: null,
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to fetch users' }
  }
}

export async function grantPoints(
  userId: string,
  amount: number
): Promise<{ success: boolean; error: string | null }> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    return { success: false, error: '1 이상의 정수만 입력해주세요.' }
  }
  try {
    const supabase = createAdminClient()
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('current_points')
      .eq('user_id', userId)
      .single()
    if (fetchError || !user) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' }
    }
    const newPoints = user.current_points + amount
    const { error: updateError } = await supabase
      .from('users')
      .update({ current_points: newPoints })
      .eq('user_id', userId)
    if (updateError) {
      return { success: false, error: updateError.message }
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

/** 관리자 대시보드용 지표: 전사 기부 통계 + 진행 중 이벤트 수 + 승인 대기 건수 */
export async function getAdminDashboardStats(): Promise<{
  totalCurrent: number
  totalTarget: number
  progress: number
  completedCount: number
  activeEventsCount: number
  pendingCount: number
  error: string | null
}> {
  try {
    const donation = await getTotalDonationStats()
    let pendingCount = 0
    let activeEventsCount = 0
    try {
      const supabase = createAdminClient()
      const [pendingRes, eventsRes] = await Promise.all([
        supabase.from('event_submissions').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      ])
      if (!pendingRes.error) pendingCount = pendingRes.count ?? 0
      if (!eventsRes.error) activeEventsCount = eventsRes.count ?? 0
    } catch {
      // 테이블이 없거나 RLS 등으로 실패 시 0으로 둠
    }
    return {
      totalCurrent: donation.totalCurrent,
      totalTarget: donation.totalTarget,
      progress: donation.progress,
      completedCount: donation.completedCount,
      activeEventsCount,
      pendingCount,
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

export async function getSiteContentForAdmin(): Promise<Record<string, string>> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('site_content').select('key, value')
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

    const { error: delTx } = await supabase.from('point_transactions').delete().gte('transaction_id', '')
    const { error: delDon } = await supabase.from('donations').delete().gte('donation_id', '')
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

    const { data: targets } = await supabase.from('donation_targets').select('target_id').limit(4)
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
