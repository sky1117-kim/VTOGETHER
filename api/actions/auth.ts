'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDeptNameByEmail } from '@/lib/seah-orgsync'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

/** 로그인 없이 테스트할 때 사용할 테스트 유저 ID (env에 설정하면 비로그인 시 이 유저로 동작) */
const GUEST_TEST_USER_ID = (process.env.GUEST_TEST_USER_ID || '').trim()

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 로그인 안 된 상태에서 테스트용 유저 ID가 설정되어 있으면 해당 유저로 동작
  if (!user && GUEST_TEST_USER_ID) {
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
    .single()

  if (error || !userData) {
    return {
      id: user.id,
      user_id: user.id,
      email: user.email ?? null,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      dept_name: null,
      current_points: 0,
      current_medals: 0,
      total_donated_amount: 0,
      level: 'ECO_KEEPER',
      is_admin: false,
    }
  }

  // MAU 집계용: 접속 시 last_active_at 갱신 (비동기, 응답 지연 최소화)
  const now = new Date().toISOString()
  void supabase
    .from('users')
    .update({ last_active_at: now })
    .eq('user_id', user.id)
    .then(() => {}, () => {})

  // 부서가 비어 있으면 세아웍스에서 백그라운드 동기화 (재로그인 불필요)
  if (!userData.dept_name?.trim() && user.email) {
    void (async () => {
      try {
        const deptName = await getDeptNameByEmail(user.email!)
        if (deptName) {
          const admin = createAdminClient()
          await admin.from('users').update({ dept_name: deptName }).eq('user_id', user.id)
          revalidatePath('/', 'layout')
        }
      } catch {
        // 실패해도 무시 (다음 접속 시 재시도)
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
