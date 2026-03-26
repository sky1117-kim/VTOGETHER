'use server'

import { getPublicAppOrigin } from '@/lib/public-app-url'
import { sendGoogleChatAlert } from '@/lib/google-chat-alert'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const supabase = await createClient()

  // 로그인 후 돌아갈 경로 (미들웨어에서 전달받은 next 파라미터)
  const next = formData.get('next') as string | null
  const callbackUrl = next && next.startsWith('/')
    ? `${getPublicAppOrigin()}/auth/callback?next=${encodeURIComponent(next)}`
    : `${getPublicAppOrigin()}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        hd: 'vntgcorp.com', // 도메인 제한
        prompt: 'select_account', // 이미 로그인된 구글 계정 선택 화면 표시
      },
    },
  })

  if (error) {
    await sendGoogleChatAlert({
      source: 'server',
      title: 'loginAction OAuth 시작 실패',
      message: error.message,
      path: '/login',
    })
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    redirect(data.url)
  }

  redirect('/login?error=' + encodeURIComponent('로그인 URL을 생성할 수 없습니다.'))
}
