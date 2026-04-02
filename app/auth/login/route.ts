import { sendGoogleChatAlert } from '@/lib/google-chat-alert'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const origin = new URL(request.url).origin

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        hd: 'vntgcorp.com', // 도메인 제한
        prompt: 'select_account', // 이미 로그인된 구글 계정 선택 화면 표시
      },
    },
  })

  if (error) {
    await sendGoogleChatAlert({
      source: 'server',
      title: 'OAuth 시작 실패',
      message: error.message,
      path: '/auth/login',
    })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.redirect(data.url)
}
