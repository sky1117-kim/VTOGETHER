import { createClient } from '@/lib/supabase/server'
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

    // @vntg.co.kr 도메인 검증
    if (data.user?.email && !data.user.email.endsWith('@vntg.co.kr')) {
      await supabase.auth.signOut()
      return NextResponse.redirect('/login?error=invalid_domain')
    }

    // 최초 로그인 시 Users 테이블에 자동 생성
    if (data.user) {
      const { error: upsertError } = await supabase
        .from('users')
        .upsert(
          {
            user_id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
          },
          {
            onConflict: 'user_id',
          }
        )

      if (upsertError) {
        console.error('Error upserting user:', upsertError)
      }
    }
  }

  return redirect(next)
}
