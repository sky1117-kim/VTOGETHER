import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getErrorMessage, sendGoogleChatAlert } from '@/lib/google-chat-alert'
import { getPublicAppOrigin } from '@/lib/public-app-url'
import { getDeptNameByEmail } from '@/lib/seah-orgsync'
import { NextResponse } from 'next/server'

/**
 * Route Handler에서는 next/navigation의 redirect() 대신 NextResponse.redirect만 사용합니다.
 * (redirect()는 Server Component/Action용이며, 여기서는 500으로 이어질 수 있습니다.)
 */
function toAbsoluteRedirect(path: string, requestUrl: URL) {
  const safePath = path.startsWith('/') ? path : '/'
  const appOrigin = getPublicAppOrigin()
  return new URL(safePath, appOrigin || requestUrl.origin)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const oauthError = requestUrl.searchParams.get('error')
  const oauthErrorDesc = requestUrl.searchParams.get('error_description')
  const nextRaw = requestUrl.searchParams.get('next') || '/'
  const next = nextRaw.startsWith('/') ? nextRaw : '/'

  // Supabase/Google이 에러 쿼리로 돌려보낸 경우
  if (oauthError) {
    const msg = oauthErrorDesc || oauthError
    return NextResponse.redirect(
      toAbsoluteRedirect(`/login?error=${encodeURIComponent(msg)}`, requestUrl)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      toAbsoluteRedirect('/login?error=missing_oauth_code', requestUrl)
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    await sendGoogleChatAlert({
      source: 'server',
      title: 'OAuth 콜백 세션 교환 실패',
      message: error.message,
      path: '/auth/callback',
    })
    return NextResponse.redirect(
      toAbsoluteRedirect(`/login?error=${encodeURIComponent(error.message)}`, requestUrl)
    )
  }

  // @vntgcorp.com 도메인 검증
  if (data.user?.email && !data.user.email.endsWith('@vntgcorp.com')) {
    await supabase.auth.signOut()
    return NextResponse.redirect(
      toAbsoluteRedirect('/login?error=invalid_domain', requestUrl)
    )
  }

  // 로그인 시마다 Google에서 이메일·이름 동기화 후 users 테이블에 반영
  // Cloud Run에서 SUPABASE_SERVICE_ROLE_KEY 누락 시 throw로 500이 나지 않도록 try/catch
  if (data.user) {
    try {
      const admin = createAdminClient()
      const userId = data.user.id
      const email = data.user.email!

      const { error: upsertError } = await admin.from('users').upsert(
        {
          user_id: userId,
          email,
          name:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            null,
        },
        { onConflict: 'user_id' }
      )

      if (upsertError) {
        console.error('[Auth] users upsert 실패:', upsertError)
        await sendGoogleChatAlert({
          source: 'server',
          title: 'users upsert 실패',
          message: upsertError.message,
          path: '/auth/callback',
        })
      }

      void (async () => {
        try {
          const deptName = await getDeptNameByEmail(email)
          if (deptName) {
            await admin.from('users').update({ dept_name: deptName }).eq('user_id', userId)
          }
        } catch (e) {
          console.warn('[Auth] 세아웍스 부서 조회 실패 (백그라운드):', e)
          await sendGoogleChatAlert({
            source: 'server',
            title: '세아웍스 부서 조회 실패',
            message: getErrorMessage(e),
            path: '/auth/callback',
          })
        }
      })()
    } catch (e) {
      console.error(
        '[Auth] Admin 클라이언트/사용자 동기화 실패(SUPABASE_SERVICE_ROLE_KEY 등 확인):',
        e
      )
      await sendGoogleChatAlert({
        source: 'server',
        title: 'Auth 사용자 동기화 실패',
        message: getErrorMessage(e),
        path: '/auth/callback',
      })
    }
  }

  return NextResponse.redirect(toAbsoluteRedirect(next, requestUrl))
}
