'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * 본인 계정을 삭제(소프트 삭제)하고 즉시 로그아웃합니다.
 * - users.deleted_at 설정
 * - 가능하면 Supabase Auth 계정도 삭제 시도
 */
export async function deleteMyAccount(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const nowIso = new Date().toISOString()
  const admin = createAdminClient()

  const { error: softDeleteError } = await admin
    .from('users')
    .update({
      deleted_at: nowIso,
      is_admin: false,
      updated_at: nowIso,
    })
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (softDeleteError) {
    throw new Error(`계정 삭제 실패: ${softDeleteError.message}`)
  }

  // auth.users에 있는 실제 인증 계정도 정리 시도 (실패해도 소프트삭제는 유지)
  try {
    await admin.auth.admin.deleteUser(user.id)
  } catch {
    // 일부 테스트/수동 계정은 auth.users에 없을 수 있어 무시
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

/** 로그인 없이 테스트할 때 사용할 테스트 유저 ID (운영 환경에서는 비활성화) */
const GUEST_TEST_USER_ID = (process.env.GUEST_TEST_USER_ID || '').trim()
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 운영 환경에서는 테스트 게스트 우회를 절대 허용하지 않음
  const allowGuestTestUser = process.env.NODE_ENV !== 'production'
  // 로그인 안 된 상태에서 테스트용 유저 ID가 설정되어 있으면 해당 유저로 동작
  if (!user && allowGuestTestUser && GUEST_TEST_USER_ID) {
    const { data: guestData, error: guestError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', GUEST_TEST_USER_ID)
      .is('deleted_at', null)
      .single()

    if (!guestError && guestData) {
      // MAU 집계용: 테스트 유저 접속 시에도 last_active_at 갱신
      void supabase
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('user_id', GUEST_TEST_USER_ID)
        .then(() => {}, () => {})
      return {
        id: guestData.user_id,
        user_id: guestData.user_id,
        email: guestData.email,
        name: guestData.name ?? '게스트 (테스트)',
        dept_name: guestData.dept_name,
        current_points: guestData.current_points,
        current_medals: guestData.current_medals ?? 0,
        total_donated_amount: guestData.total_donated_amount,
        level: guestData.level,
        is_admin: !!guestData.is_admin,
      }
    }
  }

  if (!user) {
    return null
  }

  // Users 테이블에서 추가 정보 가져오기
  const { data: userData, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    return null
  }

  // users에서 soft delete 되었으면 서비스 접근을 막습니다.
  if (!userData) {
    await supabase.auth.signOut()
    return null
  }

  // MAU 집계용: 접속 시 last_active_at 갱신 (비동기, 응답 지연 최소화)
  const now = new Date().toISOString()
  void supabase
    .from('users')
    .update({ last_active_at: now })
    .eq('user_id', user.id)
    .then(() => {}, () => {})

  // 부서가 비어 있으면 세아웍스 스냅샷(seah_employees + seah_org_units)에서 보강
  // 외부 API는 크론 배치가 담당하고, 서비스 경로는 DB 조회만 수행합니다.
  if (!userData.dept_name?.trim() && user.email) {
    void (async () => {
      try {
        const admin = createAdminClient()
        const normalizedEmail = user.email!.trim().toLowerCase()
        const { data: snap } = await admin
          .from('seah_employees')
          .select('org_code')
          .eq('email', normalizedEmail)
          .maybeSingle()

        let deptName: string | null = null
        if (snap?.org_code) {
          const { data: unit } = await admin
            .from('seah_org_units')
            .select('org_name')
            .eq('org_code', snap.org_code)
            .maybeSingle()
          deptName = unit?.org_name ?? null
        }

        if (deptName) {
          await admin.from('users').update({ dept_name: deptName }).eq('user_id', user.id)
          revalidatePath('/', 'layout')
        }
      } catch {
        // 스냅샷 테이블 미생성/조회 실패 시에도 본 기능은 정상 동작
      }
    })()
  }

  return {
    id: user.id,
    user_id: user.id,
    email: user.email,
    name: userData.name,
    dept_name: userData.dept_name,
    current_points: userData.current_points,
    current_medals: userData.current_medals ?? 0,
    total_donated_amount: userData.total_donated_amount,
    level: userData.level,
    is_admin: !!userData.is_admin,
  }
}
