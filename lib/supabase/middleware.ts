import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicCredentials } from '@/lib/supabase/public-credentials'

// Supabase 인증 쿠키를 정리해서 잘못된 refresh token 루프를 끊습니다.
function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  const authCookies = request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name) => name.startsWith('sb-'))

  authCookies.forEach((name) => {
    request.cookies.delete(name)
    response.cookies.delete(name)
  })
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // OAuth PKCE: code_verifier 쿠키가 /auth/callback 전에 지워지면 exchangeCodeForSession이 실패합니다.
  // /auth/* 뿐 아니라 /login 에서 구글 로그인 직전에도 getUser()가 쿠키를 건드리지 않도록 건너뜁니다.
  if (
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/login')
  ) {
    return supabaseResponse
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabasePublicCredentials()
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // 현재 요청으로 들어온 실제 호스트 기준으로 로그인 URL을 만듭니다.
  // (NEXT_PUBLIC_APP_URL이 이전 도메인이어도 강제 이동되지 않도록 보호)
  const getLoginUrlFromRequest = () => {
    const url = new URL('/login', request.url)
    if (request.nextUrl.pathname !== '/') {
      url.searchParams.set('next', request.nextUrl.pathname)
    }
    return url
  }

  // refresh token 유실/만료 시 인증 쿠키를 정리하고 로그인으로 보냅니다.
  if (error?.code === 'refresh_token_not_found') {
    const url = getLoginUrlFromRequest()
    const redirectResponse = NextResponse.redirect(url)
    clearSupabaseAuthCookies(request, redirectResponse)
    return redirectResponse
  }

  // 비로그인 사용자는 /login으로 리다이렉트 (로그인·OAuth 콜백 경로는 제외)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = getLoginUrlFromRequest()
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely.

  return supabaseResponse
}
