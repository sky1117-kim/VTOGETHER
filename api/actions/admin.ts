'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getTotalDonationStats } from '@/api/queries/donation'
import { scheduleEarnedNotificationEmail } from '@/lib/send-earned-notification-email'

export type SiteContentKey = 'hero_season_badge' | 'hero_title' | 'hero_subtitle'

export type UserRow = {
  user_id: string
  email: string
  name: string | null
  dept_name: string | null
  current_points: number
  current_medals: number
  total_donated_amount: number
  level: string
  is_admin: boolean
  /** MAU 집계용: 최근 30일 내 접속 시 갱신됨 (016 마이그레이션) */
  last_active_at: string | null
}

export type AdminPointTransactionFilter = {
  q?: string
  txType?: 'ALL' | 'EARNED' | 'DONATED' | 'USED'
  currencyType?: 'ALL' | 'V_CREDIT' | 'V_MEDAL'
  relatedType?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export type AdminPointTransactionRow = {
  transaction_id: string
  user_id: string
  type: 'EARNED' | 'DONATED' | 'USED'
  amount: number
  related_type: string | null
  description: string | null
  currency_type: 'V_CREDIT' | 'V_MEDAL'
  user_email: string | null
  user_name: string | null
  donation_target_name: string | null
  created_at: string
}

export async function getUsersForAdmin(): Promise<{ data: UserRow[] | null; error: string | null }> {
  try {
    const supabase = createAdminClient()
    let selectColumns =
      'user_id, email, name, dept_name, current_points, current_medals, total_donated_amount, level, is_admin, last_active_at'
    let { data, error } = await supabase
      .from('users')
      .select(selectColumns)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    // last_active_at 컬럼 없음(016 미실행) 시 제외하고 재시도
    if (error?.message?.includes('last_active_at')) {
      selectColumns =
        'user_id, email, name, dept_name, current_points, current_medals, total_donated_amount, level, is_admin'
      const retry = await supabase.from('users').select(selectColumns).is('deleted_at', null).order('created_at', { ascending: false })
      data = retry.data
      error = retry.error
      if (!error && data) {
        return {
          data: (data ?? []).map((r) => {
            const row = r as unknown as Record<string, unknown>
            return {
              ...row,
              is_admin: !!(row.is_admin as boolean),
              current_medals: Number(row.current_medals ?? 0),
              last_active_at: null,
            } as UserRow
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
          .select('user_id, email, name, dept_name, current_points, current_medals, total_donated_amount, level')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (err2) {
          // current_medals 컬럼이 아직 없는 구버전 스키마 대응
          if (err2.message?.includes('current_medals')) {
            const retryNoMedals = await supabase
              .from('users')
              .select('user_id, email, name, dept_name, current_points, total_donated_amount, level')
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
            if (retryNoMedals.error) return { data: null, error: retryNoMedals.error.message }
            return {
              data: (retryNoMedals.data ?? []).map((r) => {
                const row = r as unknown as Record<string, unknown>
                return { ...row, is_admin: false, current_medals: 0, last_active_at: null } as UserRow
              }),
              error: null,
            }
          }
          return { data: null, error: err2.message }
        }
        return {
          data: (dataFallback ?? []).map((r) => {
            const row = r as unknown as Record<string, unknown>
            return {
              ...row,
              is_admin: false,
              current_medals: Number(row.current_medals ?? 0),
              last_active_at: null,
            } as UserRow
          }),
          error: null,
        }
      }
      return { data: null, error: error.message }
    }
    return {
      data: (data ?? []).map((r) => {
        const row = r as unknown as Record<string, unknown>
        return {
          ...row,
          is_admin: !!(row.is_admin as boolean),
          current_medals: Number(row.current_medals ?? 0),
          last_active_at: (row.last_active_at as string | null) ?? null,
        } as UserRow
      }),
      error: null,
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to fetch users' }
  }
}

/** 관리자 전용 포인트 거래 내역 조회 (직원 지급/적립/사용 통합) */
export async function getPointTransactionsForAdmin(
  filter: AdminPointTransactionFilter = {}
): Promise<{
  data: AdminPointTransactionRow[] | null
  total: number
  page: number
  pageSize: number
  error: string | null
}> {
  try {
    const supabase = createAdminClient()
    const safePage = Number.isInteger(filter.page) && (filter.page ?? 1) > 0 ? (filter.page as number) : 1
    const safePageSize =
      Number.isInteger(filter.pageSize) && (filter.pageSize ?? 30) > 0
        ? Math.min(filter.pageSize as number, 100)
        : 30
    const fromIndex = (safePage - 1) * safePageSize
    const toIndex = fromIndex + safePageSize - 1

    // 거래 목록에 필요한 컬럼만 조회해서 응답 크기를 줄입니다.
    const selectColumns =
      'transaction_id, user_id, type, amount, related_type, description, currency_type, user_email, user_name, donation_target_name, created_at'

    let query = supabase
      .from('point_transactions')
      .select(selectColumns, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (filter.txType && filter.txType !== 'ALL') query = query.eq('type', filter.txType)
    if (filter.currencyType && filter.currencyType !== 'ALL') query = query.eq('currency_type', filter.currencyType)
    if (filter.relatedType?.trim()) query = query.eq('related_type', filter.relatedType.trim())
    if (filter.from?.trim()) query = query.gte('created_at', filter.from.trim())
    if (filter.to?.trim()) query = query.lte('created_at', `${filter.to.trim()}T23:59:59.999Z`)
    if (filter.q?.trim()) {
      const q = filter.q.trim().replace(/,/g, ' ')
      query = query.or(`user_name.ilike.%${q}%,user_email.ilike.%${q}%,description.ilike.%${q}%`)
    }

    const { data, count, error } = await query.range(fromIndex, toIndex)

    // 구버전 스키마(soft delete 미적용)일 때 fallback
    if (error?.message?.includes('deleted_at')) {
      let fallbackQuery = supabase
        .from('point_transactions')
        .select(selectColumns, { count: 'exact' })
        .order('created_at', { ascending: false })
      if (filter.txType && filter.txType !== 'ALL') fallbackQuery = fallbackQuery.eq('type', filter.txType)
      if (filter.currencyType && filter.currencyType !== 'ALL') fallbackQuery = fallbackQuery.eq('currency_type', filter.currencyType)
      if (filter.relatedType?.trim()) fallbackQuery = fallbackQuery.eq('related_type', filter.relatedType.trim())
      if (filter.from?.trim()) fallbackQuery = fallbackQuery.gte('created_at', filter.from.trim())
      if (filter.to?.trim()) fallbackQuery = fallbackQuery.lte('created_at', `${filter.to.trim()}T23:59:59.999Z`)
      if (filter.q?.trim()) {
        const q = filter.q.trim().replace(/,/g, ' ')
        fallbackQuery = fallbackQuery.or(`user_name.ilike.%${q}%,user_email.ilike.%${q}%,description.ilike.%${q}%`)
      }
      const fallback = await fallbackQuery.range(fromIndex, toIndex)
      if (fallback.error) return { data: null, total: 0, page: safePage, pageSize: safePageSize, error: fallback.error.message }
      return {
        data: (fallback.data ?? []) as AdminPointTransactionRow[],
        total: fallback.count ?? 0,
        page: safePage,
        pageSize: safePageSize,
        error: null,
      }
    }

    if (error) return { data: null, total: 0, page: safePage, pageSize: safePageSize, error: error.message }
    return {
      data: (data ?? []) as AdminPointTransactionRow[],
      total: count ?? 0,
      page: safePage,
      pageSize: safePageSize,
      error: null,
    }
  } catch (e) {
    return {
      data: null,
      total: 0,
      page: 1,
      pageSize: 30,
      error: e instanceof Error ? e.message : '거래 내역 조회 실패',
    }
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

type AdminDb = ReturnType<typeof createAdminClient>

/** revalidate 없이 1명에게 C 지급. 실패 시 에러 문구, 성공 시 null */
async function applyAdminCreditGrantOnce(
  supabase: AdminDb,
  userId: string,
  amount: number,
  description: string
): Promise<string | null> {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('current_points, name, email')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()
  if (fetchError || !user) {
    return '사용자를 찾을 수 없습니다.'
  }
  const newPoints = (user.current_points ?? 0) + amount
  const { error: updateError } = await supabase
    .from('users')
    .update({ current_points: newPoints })
    .eq('user_id', userId)
  if (updateError) {
    return updateError.message
  }
  const { data: txRow, error: txError } = await supabase
    .from('point_transactions')
    .insert({
      user_id: userId,
      type: 'EARNED',
      amount,
      currency_type: 'V_CREDIT',
      related_id: null,
      related_type: 'ADMIN_GRANT',
      description,
      user_email: user.email ?? null,
      user_name: user.name ?? null,
    })
    .select('transaction_id')
    .single()
  if (txError) {
    return '거래 기록 실패: ' + txError.message
  }
  scheduleEarnedNotificationEmail({
    toEmail: user.email,
    userName: user.name,
    description,
    amount,
    currencyType: 'V_CREDIT',
    transactionId: txRow?.transaction_id,
  })
  const { error: lotErr } = await supabase.from('credit_lots').insert({
    user_id: userId,
    source_type: 'ADMIN_GRANT',
    initial_amount: amount,
    remaining_amount: amount,
    related_id: null,
    description,
  })
  if (lotErr) {
    return '크레딧 로트 기록 실패: ' + lotErr.message
  }
  return null
}

/** revalidate 없이 1명에게 M 지급 */
async function applyAdminMedalGrantOnce(
  supabase: AdminDb,
  userId: string,
  amount: number,
  description: string
): Promise<string | null> {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('current_medals, name, email')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()
  if (fetchError || !user) {
    return '사용자를 찾을 수 없습니다.'
  }
  const newMedals = Number(user.current_medals ?? 0) + amount
  const { error: updateError } = await supabase
    .from('users')
    .update({ current_medals: newMedals })
    .eq('user_id', userId)
  if (updateError) {
    return updateError.message
  }
  const { data: txRow, error: txError } = await supabase
    .from('point_transactions')
    .insert({
      user_id: userId,
      type: 'EARNED',
      amount,
      currency_type: 'V_MEDAL',
      related_id: null,
      related_type: 'ADMIN_GRANT',
      description,
      user_email: user.email ?? null,
      user_name: user.name ?? null,
    })
    .select('transaction_id')
    .single()
  if (txError) {
    return '거래 기록 실패: ' + txError.message
  }
  scheduleEarnedNotificationEmail({
    toEmail: user.email,
    userName: user.name,
    description,
    amount,
    currencyType: 'V_MEDAL',
    transactionId: txRow?.transaction_id,
  })
  return null
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
    // 호출자가 관리자인지 확인 (서비스 롤 클라이언트만으로는 누구나 액션을 못 막으므로 필수)
    const supabaseAuth = await createClient()
    const {
      data: { user: caller },
    } = await supabaseAuth.auth.getUser()
    if (!caller) return { success: false, error: '로그인이 필요합니다.' }
    const adminCheck = createAdminClient()
    const { data: me, error: meErr } = await adminCheck
      .from('users')
      .select('is_admin')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .single()
    if (meErr || !me?.is_admin) {
      return { success: false, error: '관리자만 V.Credit을 수동 지급할 수 있습니다.' }
    }

    const supabase = createAdminClient()
    const description = reason?.trim() || '관리자 지급'
    const err = await applyAdminCreditGrantOnce(supabase, userId, amount, description)
    if (err) {
      return { success: false, error: err }
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

/** 관리자: 선택한 여러 명에게 동일 금액·동일 사유로 일괄 지급 (최대 80명) */
export async function grantCurrencyBatchToUsers(params: {
  userIds: string[]
  currency: 'V_CREDIT' | 'V_MEDAL'
  amount: number
  reason?: string | null
}): Promise<{
  success: boolean
  error: string | null
  grantedCount: number
  failed: { userId: string; detail: string }[]
}> {
  const MAX = 80
  if (params.amount <= 0 || !Number.isInteger(params.amount)) {
    return { success: false, error: '1 이상의 정수만 입력해주세요.', grantedCount: 0, failed: [] }
  }
  const rawIds = [...new Set(params.userIds.filter(Boolean))]
  if (rawIds.length === 0) {
    return { success: false, error: '지급할 직원을 한 명 이상 선택해주세요.', grantedCount: 0, failed: [] }
  }
  if (rawIds.length > MAX) {
    return { success: false, error: `한 번에 지급 가능한 인원은 최대 ${MAX}명입니다.`, grantedCount: 0, failed: [] }
  }
  const unique = rawIds
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user: caller },
    } = await supabaseAuth.auth.getUser()
    if (!caller) {
      return { success: false, error: '로그인이 필요합니다.', grantedCount: 0, failed: [] }
    }
    const adminCheck = createAdminClient()
    const { data: me, error: meErr } = await adminCheck
      .from('users')
      .select('is_admin')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .single()
    if (meErr || !me?.is_admin) {
      return {
        success: false,
        error: params.currency === 'V_CREDIT' ? '관리자만 V.Credit을 수동 지급할 수 있습니다.' : '관리자만 V.Medal을 수동 지급할 수 있습니다.',
        grantedCount: 0,
        failed: [],
      }
    }

    const supabase = createAdminClient()
    const description = params.reason?.trim() || '관리자 지급'
    const failed: { userId: string; detail: string }[] = []
    let grantedCount = 0

    for (const userId of unique) {
      const err =
        params.currency === 'V_CREDIT'
          ? await applyAdminCreditGrantOnce(supabase, userId, params.amount, description)
          : await applyAdminMedalGrantOnce(supabase, userId, params.amount, description)
      if (err) {
        failed.push({ userId, detail: err })
      } else {
        grantedCount++
      }
    }

    if (grantedCount > 0) {
      revalidatePath('/admin')
      revalidatePath('/admin/point-grant')
      revalidatePath('/')
      revalidatePath('/donation')
      revalidatePath('/shop')
      revalidatePath('/my')
    }

    const success = failed.length === 0 && grantedCount > 0
    let error: string | null = null
    if (grantedCount === 0 && failed.length > 0) {
      error = failed.length === 1 ? failed[0].detail : `전원 지급 실패 (${failed.length}명). 첫 오류: ${failed[0].detail}`
    } else if (failed.length > 0) {
      error = `${failed.length}명만 실패했습니다. 나머지 ${grantedCount}명은 지급되었습니다.`
    }

    return { success, error, grantedCount, failed }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : '일괄 지급 실패',
      grantedCount: 0,
      failed: [],
    }
  }
}

/** 관리자: V.Medal 수동 지급 (users.current_medals + point_transactions, credit_lots 없음) */
export async function grantMedals(
  userId: string,
  amount: number,
  reason?: string | null
): Promise<{ success: boolean; error: string | null }> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    return { success: false, error: '1 이상의 정수만 입력해주세요.' }
  }
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user: caller },
    } = await supabaseAuth.auth.getUser()
    if (!caller) return { success: false, error: '로그인이 필요합니다.' }
    const adminCheck = createAdminClient()
    const { data: me, error: meErr } = await adminCheck
      .from('users')
      .select('is_admin')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .single()
    if (meErr || !me?.is_admin) {
      return { success: false, error: '관리자만 V.Medal을 수동 지급할 수 있습니다.' }
    }

    const supabase = createAdminClient()
    const description = reason?.trim() || '관리자 지급'
    const err = await applyAdminMedalGrantOnce(supabase, userId, amount, description)
    if (err) {
      return { success: false, error: err }
    }
    revalidatePath('/admin')
    revalidatePath('/')
    revalidatePath('/shop')
    revalidatePath('/my')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '메달 지급 실패' }
  }
}

/**
 * 관리자 수동 지급(ADMIN_GRANT + 적립) 한 건을 되돌립니다.
 * - V.Credit: 해당 지급으로 생긴 credit_lots가 **한 번도 차감되지 않았을 때만** 가능합니다.
 * - V.Medal: 현재 잔액이 지급액 이상일 때만 차감합니다.
 */
export async function revertAdminGrantTransaction(
  transactionId: string
): Promise<{ success: boolean; error: string | null }> {
  const nowIso = new Date().toISOString()
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user: caller },
    } = await supabaseAuth.auth.getUser()
    if (!caller) return { success: false, error: '로그인이 필요합니다.' }

    const supabase = createAdminClient()
    const { data: me, error: meErr } = await supabase
      .from('users')
      .select('is_admin')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .single()
    if (meErr || !me?.is_admin) {
      return { success: false, error: '관리자만 지급 취소를 할 수 있습니다.' }
    }

    let txQuery = supabase
      .from('point_transactions')
      .select('transaction_id, user_id, type, amount, currency_type, related_type, created_at')
      .eq('transaction_id', transactionId)
      .is('deleted_at', null)
      .single()

    let { data: tx, error: txErr } = await txQuery
    if (txErr?.message?.includes('deleted_at')) {
      const retry = await supabase
        .from('point_transactions')
        .select('transaction_id, user_id, type, amount, currency_type, related_type, created_at')
        .eq('transaction_id', transactionId)
        .single()
      tx = retry.data
      txErr = retry.error
    }
    if (txErr || !tx) {
      return { success: false, error: '거래를 찾을 수 없거나 이미 취소되었습니다.' }
    }
    const row = tx as {
      user_id: string
      type: string
      amount: number
      currency_type: string
      related_type: string | null
    }
    if (row.type !== 'EARNED' || row.related_type !== 'ADMIN_GRANT') {
      return { success: false, error: '관리자 수동 지급(적립) 건만 취소할 수 있습니다.' }
    }
    const amount = Number(row.amount)
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return { success: false, error: '취소할 수 없는 금액입니다.' }
    }

    const { data: urow, error: uErr } = await supabase
      .from('users')
      .select('current_points, current_medals')
      .eq('user_id', row.user_id)
      .is('deleted_at', null)
      .single()
    if (uErr || !urow) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' }
    }

    /** 크레딧 취소 시 거래 soft-delete 실패하면 로트 복구에 사용 */
    let matchedLotId: string | null = null

    if (row.currency_type === 'V_CREDIT') {
      const cur = Number((urow as { current_points: number }).current_points ?? 0)
      if (cur < amount) {
        return { success: false, error: '직원 C 잔액이 부족해 취소할 수 없습니다. (이미 사용·차감된 가능성)' }
      }

      const txTime = new Date((tx as { created_at: string }).created_at).getTime()
      const { data: lots, error: lotErr } = await supabase
        .from('credit_lots')
        .select('lot_id, initial_amount, remaining_amount, created_at')
        .eq('user_id', row.user_id)
        .eq('source_type', 'ADMIN_GRANT')
        .eq('initial_amount', amount)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(40)

      if (lotErr) {
        return { success: false, error: '크레딧 로트 조회 실패: ' + lotErr.message }
      }
      const untouched = (lots ?? []).filter(
        (l) =>
          Number((l as { initial_amount: number }).initial_amount) ===
          Number((l as { remaining_amount: number }).remaining_amount)
      )
      let matched: { lot_id: string } | null = null
      let bestDiff = Infinity
      for (const l of untouched) {
        const lotCreated = new Date((l as { created_at: string }).created_at).getTime()
        const diff = Math.abs(lotCreated - txTime)
        if (diff < bestDiff && diff <= 20_000) {
          bestDiff = diff
          matched = { lot_id: (l as { lot_id: string }).lot_id }
        }
      }
      if (!matched) {
        return {
          success: false,
          error:
            '해당 지급과 짝이 되는 크레딧 로트를 찾지 못했거나, 이미 기부·사용으로 일부 소진되었습니다. 이 경우 자동 취소가 불가합니다.',
        }
      }
      matchedLotId = matched.lot_id

      const { error: upUser } = await supabase
        .from('users')
        .update({ current_points: cur - amount })
        .eq('user_id', row.user_id)
      if (upUser) return { success: false, error: upUser.message }

      const { error: delLot } = await supabase
        .from('credit_lots')
        .update({ deleted_at: nowIso, updated_at: nowIso })
        .eq('lot_id', matched.lot_id)
        .is('deleted_at', null)
      if (delLot) {
        await supabase.from('users').update({ current_points: cur }).eq('user_id', row.user_id)
        return { success: false, error: '로트 취소 실패: ' + delLot.message }
      }
    } else if (row.currency_type === 'V_MEDAL') {
      const curM = Number((urow as { current_medals: number }).current_medals ?? 0)
      if (curM < amount) {
        return { success: false, error: '직원 M 잔액이 부족해 취소할 수 없습니다. (이미 상점 등에서 사용했을 수 있음)' }
      }
      const { error: upUser } = await supabase
        .from('users')
        .update({ current_medals: curM - amount })
        .eq('user_id', row.user_id)
      if (upUser) return { success: false, error: upUser.message }
    } else {
      return { success: false, error: '지원하지 않는 재화 유형입니다.' }
    }

    const delTxPayload = { deleted_at: nowIso }
    let { error: delTxErr } = await supabase
      .from('point_transactions')
      .update(delTxPayload as never)
      .eq('transaction_id', transactionId)
      .is('deleted_at', null)

    if (delTxErr?.message?.includes('deleted_at')) {
      const retryDel = await supabase.from('point_transactions').delete().eq('transaction_id', transactionId)
      delTxErr = retryDel.error
    }
    if (delTxErr) {
      if (row.currency_type === 'V_CREDIT') {
        const cur = Number((urow as { current_points: number }).current_points ?? 0)
        await supabase.from('users').update({ current_points: cur }).eq('user_id', row.user_id)
        if (matchedLotId) {
          await supabase
            .from('credit_lots')
            .update({ deleted_at: null, updated_at: nowIso })
            .eq('lot_id', matchedLotId)
        }
      } else {
        const curM = Number((urow as { current_medals: number }).current_medals ?? 0)
        await supabase.from('users').update({ current_medals: curM }).eq('user_id', row.user_id)
      }
      return { success: false, error: '거래 취소 기록 실패: ' + delTxErr.message }
    }

    revalidatePath('/admin/point-grant')
    revalidatePath('/admin')
    revalidatePath('/')
    revalidatePath('/donation')
    revalidatePath('/shop')
    revalidatePath('/my')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '지급 취소 실패' }
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

/** 관리자 전용: 사용자 계정 삭제(soft delete) */
export async function deleteUserAccountByAdmin(
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user: caller },
    } = await supabaseAuth.auth.getUser()
    if (!caller) return { success: false, error: '로그인이 필요합니다.' }
    if (caller.id === userId) {
      return { success: false, error: '본인 계정은 관리자 목록에서 삭제할 수 없습니다. 마이페이지에서 탈퇴해주세요.' }
    }

    const admin = createAdminClient()
    const { data: me, error: meError } = await admin
      .from('users')
      .select('is_admin')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .single()
    if (meError || !me?.is_admin) {
      return { success: false, error: '관리자만 계정을 삭제할 수 있습니다.' }
    }

    const nowIso = new Date().toISOString()
    const { error: softDeleteError } = await admin
      .from('users')
      .update({
        deleted_at: nowIso,
        is_admin: false,
        updated_at: nowIso,
      })
      .eq('user_id', userId)
      .is('deleted_at', null)
    if (softDeleteError) {
      return { success: false, error: softDeleteError.message }
    }

    // auth.users 계정도 함께 제거 시도 (없거나 권한 이슈여도 서비스 계정 삭제는 유지)
    try {
      await admin.auth.admin.deleteUser(userId)
    } catch {
      // 수동 생성 테스트 계정 등은 auth.users에 없을 수 있음
    }

    revalidatePath('/admin')
    revalidatePath('/admin/recent-users')
    revalidatePath('/', 'layout')
    revalidatePath('/my')
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '계정 삭제 실패' }
  }
}

/** 네비게이션 배지용: 승인 대기 인증 건수만 조회 (가벼운 쿼리) */
export async function getPendingVerificationCount(): Promise<number> {
  try {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from('event_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .is('deleted_at', null)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
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
    const [donation, matchingByTarget] = await Promise.all([
      getTotalDonationStats(),
      getMatchingAmountByTarget(),
    ])
    const totalMatching = Object.values(matchingByTarget).reduce((sum, v) => sum + v, 0)
    const totalCurrentWithMatching = donation.totalCurrent + totalMatching
    const progressWithMatching = donation.totalTarget > 0
      ? (totalCurrentWithMatching / donation.totalTarget) * 100
      : 0
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
      totalCurrent: totalCurrentWithMatching,
      totalTarget: donation.totalTarget,
      progress: progressWithMatching,
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

/** 이벤트 적립 현황: People/Culture별 적립, 매칭금 (Medal->Credit 전환분 기부만 매칭 대상) */
export async function getEventEarnedStats(): Promise<{
  peopleCreditEarned: number
  peopleMedalEarned: number
  cultureCreditEarned: number
  cultureMedalEarned: number
  medalExchangeDonation: number
  matchingAmount: number
  totalCreditEarned: number
  totalMedalEarned: number
  totalCollected: number
  error: string | null
}> {
  const empty = {
    peopleCreditEarned: 0,
    peopleMedalEarned: 0,
    cultureCreditEarned: 0,
    cultureMedalEarned: 0,
    medalExchangeDonation: 0,
    matchingAmount: 0,
    totalCreditEarned: 0,
    totalMedalEarned: 0,
    totalCollected: 0,
    error: null as string | null,
  }
  try {
    const supabase = createAdminClient()
    const { data: txRows, error: txErr } = await supabase
      .from('point_transactions')
      .select('amount, related_id, currency_type')
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

    let peopleCreditEarned = 0
    let peopleMedalEarned = 0
    let cultureCreditEarned = 0
    let cultureMedalEarned = 0
    for (const t of txs) {
      const subId = (t as { related_id: string }).related_id
      const amount = Number((t as { amount: number }).amount) || 0
      const currencyType = (t as { currency_type?: string }).currency_type
      const eventId = subId ? subToEvent.get(subId) : null
      const category = eventId ? eventToCategory.get(eventId) : null
      const isMedal = currencyType === 'V_MEDAL'
      if (category === 'PEOPLE') {
        if (isMedal) peopleMedalEarned += amount
        else peopleCreditEarned += amount
      } else if (category === 'CULTURE' || category === 'V_TOGETHER') {
        if (isMedal) cultureMedalEarned += amount
        else cultureCreditEarned += amount
      }
    }

    const { data: allocRows } = await supabase
      .from('donation_lot_allocations')
      .select('allocated_amount, lot_id, donation_id')
      .is('deleted_at', null)
    const lotIds = [...new Set((allocRows ?? []).map((a) => a.lot_id))]
    const { data: lots } = lotIds.length
      ? await supabase.from('credit_lots').select('lot_id, source_type').in('lot_id', lotIds).is('deleted_at', null)
      : { data: [] }
    const lotSourceMap = new Map((lots ?? []).map((l) => [l.lot_id, l.source_type]))
    const medalExchangeDonation = (allocRows ?? []).reduce((sum, row) => {
      const source = lotSourceMap.get(row.lot_id)
      return source === 'MEDAL_EXCHANGE' ? sum + Number(row.allocated_amount ?? 0) : sum
    }, 0)
    const matchingAmount = medalExchangeDonation
    const totalCreditEarned = peopleCreditEarned + cultureCreditEarned
    const totalMedalEarned = peopleMedalEarned + cultureMedalEarned
    const totalCollected = totalCreditEarned + medalExchangeDonation + matchingAmount
    return {
      peopleCreditEarned,
      peopleMedalEarned,
      cultureCreditEarned,
      cultureMedalEarned,
      medalExchangeDonation,
      matchingAmount,
      totalCreditEarned,
      totalMedalEarned,
      totalCollected,
      error: null,
    }
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : '이벤트 적립 현황 조회 실패' }
  }
}

/** 관리자: 기부처별 매칭금(V.Medal 전환 기부금 1:1) 합계 조회 */
export async function getMatchingAmountByTarget(): Promise<Record<string, number>> {
  try {
    const supabase = createAdminClient()
    const { data: allocRows } = await supabase
      .from('donation_lot_allocations')
      .select('donation_id, lot_id, allocated_amount')
      .is('deleted_at', null)
    if (!allocRows?.length) return {}

    const lotIds = [...new Set(allocRows.map((a) => a.lot_id))]
    const { data: lots } = await supabase
      .from('credit_lots')
      .select('lot_id, source_type')
      .in('lot_id', lotIds)
      .is('deleted_at', null)

    const medalLotIds = new Set(
      (lots ?? []).filter((l) => l.source_type === 'MEDAL_EXCHANGE').map((l) => l.lot_id)
    )
    const medalAllocs = allocRows.filter((a) => medalLotIds.has(a.lot_id))
    if (!medalAllocs.length) return {}

    const donationIds = [...new Set(medalAllocs.map((a) => a.donation_id))]
    const { data: donations } = await supabase
      .from('donations')
      .select('donation_id, target_id')
      .in('donation_id', donationIds)

    const donationToTarget = new Map((donations ?? []).map((d) => [d.donation_id, d.target_id]))
    const result: Record<string, number> = {}
    for (const row of medalAllocs) {
      const targetId = donationToTarget.get(row.donation_id)
      if (targetId) {
        result[targetId] = (result[targetId] ?? 0) + Number(row.allocated_amount)
      }
    }
    return result
  } catch {
    return {}
  }
}

export type OverTargetDonorRow = {
  donation_id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  amount: number
  excess: number
  created_at: string
}

/**
 * 관리자: 특정 기부처에서 목표 금액을 초과한 기부 내역 조회.
 * 기부 시점 기준 누적 합계가 target_amount를 초과한 분부터 반환.
 * excess > 0 이면 해당 기부 중 초과분, amount 전체가 초과면 excess = amount.
 */
export async function getOverTargetDonors(targetId: string): Promise<{
  data: OverTargetDonorRow[]
  targetAmount: number
  targetName: string
  error: string | null
}> {
  try {
    const supabase = createAdminClient()

    const { data: targetRow, error: targetErr } = await supabase
      .from('donation_targets')
      .select('target_amount, name')
      .eq('target_id', targetId)
      .is('deleted_at', null)
      .single()
    if (targetErr || !targetRow) return { data: [], targetAmount: 0, targetName: '', error: targetErr?.message ?? '기부처 없음' }

    const { data: donationRows, error: donErr } = await supabase
      .from('donations')
      .select('donation_id, user_id, amount, created_at')
      .eq('target_id', targetId)
      .order('created_at', { ascending: true })
    if (donErr) return { data: [], targetAmount: targetRow.target_amount, targetName: targetRow.name, error: donErr.message }

    const donations = donationRows ?? []
    if (donations.length === 0) return { data: [], targetAmount: targetRow.target_amount, targetName: targetRow.name, error: null }

    const userIds = [...new Set(donations.map((d) => d.user_id))]
    const { data: userRows } = await supabase
      .from('users')
      .select('user_id, name, email')
      .in('user_id', userIds)
      .is('deleted_at', null)
    const userMap = new Map((userRows ?? []).map((u) => [u.user_id, u]))

    const target = targetRow.target_amount
    let running = 0
    const result: OverTargetDonorRow[] = []

    for (const d of donations) {
      const prev = running
      running += Number(d.amount)
      if (running > target) {
        const excess = running - Math.max(prev, target)
        const user = userMap.get(d.user_id)
        result.push({
          donation_id: d.donation_id,
          user_id: d.user_id,
          user_name: user?.name ?? null,
          user_email: user?.email ?? null,
          amount: Number(d.amount),
          excess: Math.min(excess, Number(d.amount)),
          created_at: d.created_at,
        })
      }
    }

    return { data: result, targetAmount: target, targetName: targetRow.name, error: null }
  } catch (e) {
    return { data: [], targetAmount: 0, targetName: '', error: e instanceof Error ? e.message : '조회 실패' }
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
    await supabase.from('users').update({ current_points: 0, current_medals: 0, total_donated_amount: 0 })

    await supabase.from('site_content').upsert(
      [
        { key: 'hero_season_badge', value: '2026 Season 1' },
        { key: 'hero_title', value: '나의 활동이\n세상의 기회가 되도록' },
        { key: 'hero_subtitle', value: '획득한 V.Credit로 기부하고\n나의 ESG Level을 올려보세요!' },
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
