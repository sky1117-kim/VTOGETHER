import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/api/actions/auth'
import { getPendingVerificationCount } from '@/api/actions/admin'
import { getPendingHealthChallengeLogCount } from '@/api/actions/admin/health-challenges'
import { AdminNav } from './components/AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, pendingCount, healthPending] = await Promise.all([
    getCurrentUser(),
    getPendingVerificationCount(),
    getPendingHealthChallengeLogCount(),
  ])
  if (!user) {
    redirect('/login')
  }
  if (!user.is_admin) {
    redirect('/?admin=denied')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-[#f3f4f6]">
      {/* 상단 헤더: 모바일에서도 항상 보임 */}
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/95 shadow-soft backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press-link"
            >
              <span className="text-lg">←</span>
              <span className="hidden sm:inline">메인으로</span>
            </Link>
            <span className="text-gray-200">|</span>
            <span className="text-base font-bold text-gray-900">V.Together 관리자</span>
          </div>
          <div className="text-right text-xs text-gray-500 sm:text-sm">
            <span className="font-medium text-gray-700">{user.name || user.email}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-0 px-0 lg:gap-6 lg:px-6">
        {/* 사이드바: 데스크톱에서만 표시 */}
        <aside className="hidden w-64 shrink-0 flex-col gap-4 lg:flex lg:py-6">
          <div className="sticky top-[4.5rem] flex flex-col gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <p className="px-2 pb-2 text-xs font-semibold tracking-wide text-gray-400">ADMIN MENU</p>
              <AdminNav pendingVerificationCount={pendingCount} pendingHealthCount={healthPending} />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <Link
                href="/"
                className="block rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press-link"
              >
                메인 사이트 →
              </Link>
            </div>
          </div>
        </aside>

        {/* 오른쪽 영역: 모바일 네비 + 메인 콘텐츠 */}
        <div className="min-w-0 flex-1 flex flex-col">
          {/* 모바일: 상단 가로 네비 */}
          <div className="border-b border-gray-200/80 bg-white/95 px-4 py-3 shadow-soft backdrop-blur-sm lg:hidden">
            <AdminNav orientation="horizontal" pendingVerificationCount={pendingCount} pendingHealthCount={healthPending} />
          </div>
          <main className="px-4 py-6 sm:px-6 lg:px-0 lg:py-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
