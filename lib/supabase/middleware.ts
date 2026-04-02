import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicAppOrigin } from '@/lib/public-app-url'
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
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/api/cron/') ||
    request.nextUrl.pathname.startsWith('/api/debug/seah-orgsync')
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

  // 리다이렉트 origin은 반드시 "사용자가 실제 접속한 도메인" 기준이어야 합니다.
  // Cloud Run/프록시 환경에서는 request.url의 origin이 0.0.0.0/localhost처럼 내부 값으로 잡힐 수 있어,
  // X-Forwarded-Host/Proto를 우선 사용하고(가능하면), 그래도 내부 값이면 NEXT_PUBLIC_APP_URL로 폴백합니다.
  const getOriginFromRequest = () => {
    const forwardedHost = request.headers.get('x-forwarded-host')?.trim()
    const forwardedProto = request.headers.get('x-forwarded-proto')?.trim()
    const host = forwardedHost || request.headers.get('host') || ''
    const proto = (forwardedProto || request.nextUrl.protocol || 'https:').replace(/:$/, '')

    const hostOnly = host.split(':')[0].toLowerCase()
    if (!host || hostOnly === '0.0.0.0' || hostOnly === '127.0.0.1' || hostOnly === 'localhost') {
      return getPublicAppOrigin()
    }

    return `${proto}://${host}`
  }

  const getLoginUrlFromRequest = () => {
    const origin = getOriginFromRequest()
    const url = new URL('/login', origin)
    if (request.nextUrl.pathname !== '/') url.searchParams.set('next', request.nextUrl.pathname)
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
