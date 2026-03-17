'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      }/auth/callback`,
      queryParams: {
        hd: 'vntgcorp.com', // 도메인 제한
        prompt: 'select_account', // 이미 로그인된 구글 계정 선택 화면 표시
      },
    },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    redirect(data.url)
  }

  redirect('/login?error=' + encodeURIComponent('로그인 URL을 생성할 수 없습니다.'))
}
