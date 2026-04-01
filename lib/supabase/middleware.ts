import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicAppOrigin } from '@/lib/public-app-url'

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

  // OAuth PKCE 인증 흐름(/auth/*)에서는 code_verifier 쿠키가 반드시 유지되어야 합니다.
  // 여기서 세션 검사를 강제하면 refresh_token_not_found 분기에서 쿠키가 지워져
  // /auth/callback의 exchangeCodeForSession이 실패할 수 있어 조기 반환합니다.
  if (request.nextUrl.pathname.startsWith('/auth')) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // refresh token 유실/만료 시 인증 쿠키를 정리하고 로그인으로 보냅니다.
  if (error?.code === 'refresh_token_not_found') {
    const url = new URL('/login', getPublicAppOrigin())
    url.pathname = '/login'
    if (request.nextUrl.pathname !== '/') {
      url.searchParams.set('next', request.nextUrl.pathname)
    }

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
    const url = new URL('/login', getPublicAppOrigin())
    url.pathname = '/login'
    // 로그인 후 원래 페이지로 돌아갈 수 있도록 현재 경로를 next 파라미터로 전달
    if (request.nextUrl.pathname !== '/') {
      url.searchParams.set('next', request.nextUrl.pathname)
    }
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
