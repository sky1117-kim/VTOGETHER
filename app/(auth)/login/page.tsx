import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error, next } = await searchParams

  // 이미 로그인한 사용자는 메인 페이지(또는 next 경로)로 리다이렉트
  if (user) {
    redirect(next && next.startsWith('/') ? next : '/')
  }

  return <LoginForm error={error} next={next} />
}
