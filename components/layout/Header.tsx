import Link from 'next/link'
import { getCurrentUser } from '@/api/actions/auth'
import { signOut } from '@/api/actions/auth'
import { LevelBadge } from '@/components/my/LevelBadge'
import { getNotificationsForBell } from '@/api/queries/user'
import { PointNotificationBell } from '@/components/main/PointNotificationBell'

export async function Header() {
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null
  let recentNotifications: Awaited<ReturnType<typeof getNotificationsForBell>> = []

  try {
    user = await getCurrentUser()
  } catch {
    // 인증 비활성화 시
  }

  if (user?.id) {
    try {
      recentNotifications = await getNotificationsForBell(user.id, 7)
    } catch {
      // 알림 조회 실패 시에도 헤더는 정상 노출
    }
  }

  const displayName = user ? user.name || user.email : '게스트'
  const level = user?.level ?? 'ECO_KEEPER'

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 bg-white/80 shadow-soft backdrop-blur-xl">
      <div className="mx-auto max-w-7xl min-w-0 px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 min-w-0 items-center justify-between gap-2 sm:h-16 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
            <Link
              href="/"
              className="group flex min-w-0 shrink cursor-pointer items-center gap-2 rounded-xl py-1.5 pr-1 transition hover:bg-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 sm:gap-3 sm:pr-2"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 font-bold text-white shadow-soft transition group-hover:shadow-soft-lg group-hover:scale-105">
                V
              </div>
              <span className="min-w-0 truncate bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-base font-bold tracking-tight text-transparent sm:text-xl">
                V.Together
              </span>
            </Link>
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                홈
              </Link>
              <Link
                href="/shop"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                상점
              </Link>
              <Link
                href="/my"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                마이페이지
              </Link>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
            {user?.id && (
              <PointNotificationBell userId={user.id} notifications={recentNotifications} />
            )}
            {user?.id && <div className="hidden h-5 w-px bg-gray-200 md:block" aria-hidden />}
            <div className="mr-0.5 hidden min-w-0 flex-col items-end md:flex">
              <span className="text-xs text-gray-400">환영합니다</span>
              <span className="max-w-[140px] truncate text-sm font-bold text-gray-800 lg:max-w-[200px]">
                {displayName}
              </span>
            </div>
            <LevelBadge
              level={level}
              size="sm"
              compact
              totalDonated={user?.total_donated_amount}
            />
            {user?.is_admin && (
              <Link
                href="/admin"
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press sm:px-3 sm:text-sm"
                aria-label="관리자 페이지로 이동"
              >
                <span className="sm:hidden">관리</span>
                <span className="hidden sm:inline">관리자</span>
              </Link>
            )}
            {user ? (
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 btn-press sm:px-3 sm:text-sm"
                >
                  <span className="sm:hidden">나가기</span>
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white btn-press sm:px-4 sm:text-sm"
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
