import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDeptNameByEmail } from '@/lib/seah-orgsync'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(`/login?error=${encodeURIComponent(error.message)}`)
    }

    // @vntgcorp.com 도메인 검증
    if (data.user?.email && !data.user.email.endsWith('@vntgcorp.com')) {
      await supabase.auth.signOut()
      return NextResponse.redirect('/login?error=invalid_domain')
    }

    // 로그인 시마다 Google에서 이메일·이름 자동 동기화 후 users 테이블에 반영
    // admin 클라이언트 사용: RLS 우회하여 모든 신규 로그인 사용자가 users에 확실히 등록됨
    if (data.user) {
      const admin = createAdminClient()

      // 1) 먼저 부서 없이 즉시 users에 등록 (로그인 차단 방지)
      const { error: upsertError } = await admin
        .from('users')
        .upsert(
          {
            user_id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
          },
          { onConflict: 'user_id' }
        )

      if (upsertError) {
        console.error('[Auth] users upsert 실패:', upsertError)
      }

      // 2) 세아웍스 부서 조회는 백그라운드에서 실행 (API 타임아웃/실패 시에도 로그인은 정상 진행)
      const email = data.user.email!
      void (async () => {
        try {
          const deptName = await getDeptNameByEmail(email)
          if (deptName) {
            await admin.from('users').update({ dept_name: deptName }).eq('user_id', data.user!.id)
          }
        } catch (e) {
          console.warn('[Auth] 세아웍스 부서 조회 실패 (백그라운드):', e)
        }
      })()
    }
  }

  return redirect(next)
}
