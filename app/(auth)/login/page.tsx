import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 이미 로그인한 사용자는 메인 페이지로 리다이렉트
  if (user) {
    redirect('/')
  }

  return <LoginForm error={searchParams.error} />
}
