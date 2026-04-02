import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { getErrorMessage, sendGoogleChatAlert } from '@/lib/google-chat-alert'
import { getSupabasePublicCredentials } from '@/lib/supabase/public-credentials'
import { NextResponse, type NextRequest } from 'next/server'

/** PKCE verifier 누락은 중복 요청·프리페치·다른 기기 등에서 흔하며, 로그인 성공 후에도 알림만 남는 경우가 많습니다. */
function isBenignPkceVerifierError(message: string) {
  return message.includes('PKCE code verifier not found')
}

/**
 * Route Handler에서는 next/navigation의 redirect() 대신 NextResponse.redirect만 사용합니다.
 * (redirect()는 Server Component/Action용이며, 여기서는 500으로 이어질 수 있습니다.)
 *
 * OAuth 콜백은 사용자가 실제로 접속한 호스트로 돌아오므로, 리다이렉트도 그 origin을 씁니다.
 * (getPublicAppOrigin()만 쓰면 호스트 불일치로 세션 쿠키·다음 화면이 엇갈릴 수 있음)
 */
function toSameOriginRedirect(path: string, requestUrl: URL) {
  const safePath = path.startsWith('/') ? path : '/'
  return new URL(safePath, requestUrl.origin)
}

export async function GET(request: NextRequest) {
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
      toSameOriginRedirect(`/login?error=${encodeURIComponent(msg)}`, requestUrl)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      toSameOriginRedirect('/login?error=missing_oauth_code', requestUrl)
    )
  }

  // Route Handler에서는 next/headers의 cookies() 대신 request.cookies를 쓰는 것이 안전합니다.
  // PKCE code_verifier는 브라우저가 보낸 요청 쿠키에만 있고, cookies()와 요청이 어긋나면 교환이 실패합니다.
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabasePublicCredentials()
  let redirectPath = next
  let redirectResponse = NextResponse.redirect(
    toSameOriginRedirect(redirectPath, requestUrl)
  )

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        redirectResponse = NextResponse.redirect(
          toSameOriginRedirect(redirectPath, requestUrl)
        )
        cookiesToSet.forEach(({ name, value, options }) =>
          redirectResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    if (!isBenignPkceVerifierError(error.message)) {
      await sendGoogleChatAlert({
        source: 'server',
        title: 'OAuth 콜백 세션 교환 실패',
        message: error.message,
        path: '/auth/callback',
      })
    } else {
      console.warn('[Auth] OAuth 콜백 PKCE verifier 없음 (무시 가능):', error.message)
    }
    return NextResponse.redirect(
      toSameOriginRedirect(`/login?error=${encodeURIComponent(error.message)}`, requestUrl)
    )
  }

  // @vntgcorp.com 도메인 검증
  if (data.user?.email && !data.user.email.endsWith('@vntgcorp.com')) {
    redirectPath = '/login?error=invalid_domain'
    await supabase.auth.signOut()
    return redirectResponse
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
          // 이미 부서가 있으면 로그인 때마다 세아웍스 API를 다시 호출하지 않음
          const { data: currentUserRow } = await admin
            .from('users')
            .select('dept_name')
            .eq('user_id', userId)
            .maybeSingle()

          if (currentUserRow?.dept_name?.trim()) return

          // 실시간 외부 API 호출 대신, 배치로 적재된 세아웍스 스냅샷에서 보강
          const normalizedEmail = email.trim().toLowerCase()
          const { data: emp } = await admin
            .from('seah_employees')
            .select('org_code')
            .eq('email', normalizedEmail)
            .maybeSingle()

          let deptName: string | null = null
          if (emp?.org_code) {
            const { data: unit } = await admin
              .from('seah_org_units')
              .select('org_name')
              .eq('org_code', emp.org_code)
              .maybeSingle()
            deptName = unit?.org_name ?? null
          }

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

  return redirectResponse
}
