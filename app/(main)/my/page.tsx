import { getCurrentUser } from '@/api/actions/auth'
import { getUserEventSubmissions, getUserPointTransactions } from '@/api/queries/user'
import { LevelBadge } from '@/components/my/LevelBadge'
import { EventParticipationSection } from '@/components/my/EventParticipationSection'
import { PointDisplay } from '@/components/my/PointDisplay'
import { PointHistorySection } from '@/components/my/PointHistorySection'

export default async function MyPage() {
  const user = await getCurrentUser()

  let transactions: Awaited<ReturnType<typeof getUserPointTransactions>> = []
  let eventSubmissions: Awaited<ReturnType<typeof getUserEventSubmissions>> = []
  if (user) {
    try {
      transactions = (await getUserPointTransactions(user.id, 100)) ?? []
    } catch {
      // ignore
    }
    try {
      eventSubmissions = (await getUserEventSubmissions(user.id, 30)) ?? []
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          마이페이지
        </h1>
        <p className="mt-1 text-gray-500">
          내 ESG 활동 현황을 확인하세요
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-gray-900">
                {user ? user.name || user.email : '게스트'}
              </h2>
              {/* 계정 정보: 로그인 시 Google에서 불러온 이메일, 관리자 입력 부서 */}
              {user && (
                <dl className="mt-3 space-y-1 text-sm">
                  {user.email && (
                    <div>
                      <dt className="inline font-medium text-gray-500">이메일 </dt>
                      <dd className="inline text-gray-800">{user.email}</dd>
                    </div>
                  )}
                  {user.dept_name && (
                    <div>
                      <dt className="inline font-medium text-gray-500">부서 </dt>
                      <dd className="inline text-gray-800">{user.dept_name}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
            <LevelBadge level={user?.level ?? 'ECO_KEEPER'} size="lg" />
          </div>
        </div>

        <PointDisplay
          currentPoints={user?.current_points ?? 0}
          totalDonated={user?.total_donated_amount ?? 0}
        />

        <EventParticipationSection submissions={eventSubmissions} />
        <PointHistorySection transactions={transactions} />
      </div>
    </div>
  )
}
