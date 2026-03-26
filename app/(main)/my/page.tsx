import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/api/actions/auth'
import { getReceivedCompliments, getUserEventSubmissions, getUserPointTransactions } from '@/api/queries/user'
import { LevelBadge } from '@/components/my/LevelBadge'
import { EventParticipationSection } from '@/components/my/EventParticipationSection'
import { PointDisplay } from '@/components/my/PointDisplay'
import { PointHistorySection } from '@/components/my/PointHistorySection'
import { ReceivedComplimentsSection } from '@/components/my/ReceivedComplimentsSection'

export default async function MyPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  // 각각 독립적으로 조회 (하나 실패해도 나머지는 표시). 병렬 실행으로 속도 유지
  let transactions: Awaited<ReturnType<typeof getUserPointTransactions>> = []
  let eventSubmissions: Awaited<ReturnType<typeof getUserEventSubmissions>> = []
  let receivedCompliments: Awaited<ReturnType<typeof getReceivedCompliments>> = []
  const [txRes, subRes, compRes] = await Promise.allSettled([
    getUserPointTransactions(user.id, 100),
    getUserEventSubmissions(user.id, 30),
    getReceivedCompliments(user.id, 50),
  ])
  transactions = txRes.status === 'fulfilled' ? (txRes.value ?? []) : []
  eventSubmissions = subRes.status === 'fulfilled' ? (subRes.value ?? []) : []
  receivedCompliments = compRes.status === 'fulfilled' ? (compRes.value ?? []) : []

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white p-5 shadow-sm">
        <h1 className="inline-flex items-center gap-2 text-3xl font-extrabold tracking-tight text-gray-900">
          <span className="inline-block h-7 w-1.5 rounded-full bg-emerald-500" />
          마이페이지
        </h1>
        <p className="mt-2 text-sm font-medium text-gray-600">
          내 ESG 활동 현황을 확인하세요
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/60 to-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-gray-900">
                {user.name || user.email}
              </h2>
              {/* 계정 정보: 로그인 시 Google에서 불러온 이메일, 관리자 입력 부서 */}
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
            </div>
            <LevelBadge level={user?.level ?? 'ECO_KEEPER'} size="lg" />
          </div>
        </div>

        <PointDisplay
          currentPoints={user?.current_points ?? 0}
          currentMedals={user?.current_medals ?? 0}
          totalDonated={user?.total_donated_amount ?? 0}
        />

        <PointHistorySection transactions={transactions} />
        <EventParticipationSection submissions={eventSubmissions} />
        <ReceivedComplimentsSection compliments={receivedCompliments} />
      </div>
    </div>
  )
}
