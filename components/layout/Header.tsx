import Link from 'next/link'
import { getCurrentUser } from '@/api/actions/auth'
import { signOut } from '@/api/actions/auth'
import { LevelBadge } from '@/components/my/LevelBadge'

export async function Header() {
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null
  try {
    user = await getCurrentUser()
  } catch {
    // 인증 비활성화 시
  }

  const displayName = user ? user.name || user.email : '게스트'
  const level = user?.level ?? 'ECO_KEEPER'

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 bg-white/80 shadow-soft backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex items-center">
            <Link
              href="/"
              className="group flex shrink-0 cursor-pointer items-center gap-3 rounded-xl py-1.5 pr-2 transition hover:bg-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 font-bold text-white shadow-soft transition group-hover:shadow-soft-lg group-hover:scale-105">
                V
              </div>
              <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-lg font-bold tracking-tight text-transparent sm:text-xl">
                V.Together
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-2 hidden flex-col items-end md:flex">
              <span className="text-xs text-gray-400">환영합니다</span>
              <span className="text-sm font-bold text-gray-800">{displayName}</span>
            </div>
            <LevelBadge level={level} size="sm" totalDonated={user?.total_donated_amount} />
            {user?.is_admin && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
                aria-label="관리자 페이지로 이동"
              >
                관리자
              </Link>
            )}
            {user ? (
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 btn-press"
                >
                  로그아웃
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white btn-press"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
