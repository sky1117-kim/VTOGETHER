import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-lg">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 font-bold text-white">
              V
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            V.Together
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            ESG 경영 실천 및 조직문화 활성화 플랫폼
          </p>
        </div>

        <div className="mt-8">
          <form action="/auth/login" method="post">
            <button
              type="submit"
              className="w-full rounded-xl bg-green-600 px-4 py-3 font-bold text-white shadow-lg transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Google로 로그인
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            @vntg.co.kr 계정만 로그인 가능합니다
          </p>
        </div>
      </div>
    </div>
  )
}
