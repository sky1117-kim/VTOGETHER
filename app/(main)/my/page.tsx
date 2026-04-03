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
  const approvedSubmissionCount = eventSubmissions.filter((item) => item.status === 'APPROVED').length

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-[#00b859]/[0.08]">
      <div className="mx-auto min-w-0 max-w-7xl px-3 pb-16 pt-3 sm:px-6 sm:pt-4 lg:px-8">
        <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-4 text-slate-900 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.65)] sm:p-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#00b859]">MY ESG DASHBOARD</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">마이페이지</h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              활동 내역과 보상 현황을 한 눈에 확인할 수 있어요.
            </p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">참여 이벤트</p>
              <p className="mt-1 text-2xl font-extrabold text-[#00b859]">{eventSubmissions.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">승인 완료</p>
              <p className="mt-1 text-2xl font-extrabold text-[#00b859]">{approvedSubmissionCount}</p>
            </div>
            <a
              href="#received-compliments"
              className="block rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3 transition hover:border-[#00b859]/40 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b859]/30"
            >
              <p className="text-xs font-semibold text-slate-500">받은 칭찬</p>
              <p className="mt-1 text-2xl font-extrabold text-[#00b859]">{receivedCompliments.length}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">탭하면 아래 목록으로 이동</p>
            </a>
          </div>

          {/* 마이페이지 주요 영역 빠른 이동 */}
          <nav className="mt-4 flex flex-wrap gap-2">
            <a
              href="#point-history"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              포인트 내역
            </a>
            <a
              href="#received-compliments"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              받은 칭찬
            </a>
            <a
              href="#event-submissions"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              이벤트 제출 내역
            </a>
          </nav>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200/90 bg-white p-4 shadow-[0_14px_40px_-30px_rgba(15,23,42,0.65)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                  {user.name || user.email}
                </h2>
                <LevelBadge level={user?.level ?? 'ECO_KEEPER'} size="md" />
              </div>
              {/* 계정 정보: 로그인 시 Google에서 불러온 이메일, 관리자 입력 부서 */}
              <dl className="mt-3 space-y-1 text-sm">
                {user.email && (
                  <div>
                    <dt className="inline font-semibold text-slate-500">이메일 </dt>
                    <dd className="inline text-slate-700">{user.email}</dd>
                  </div>
                )}
                {user.dept_name && (
                  <div>
                    <dt className="inline font-semibold text-slate-500">부서 </dt>
                    <dd className="inline text-slate-700">{user.dept_name}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </section>

        <PointDisplay
          currentPoints={user?.current_points ?? 0}
          currentMedals={user?.current_medals ?? 0}
          totalDonated={user?.total_donated_amount ?? 0}
        />

        {/* 주요 섹션을 한 줄 세로 배치해 카드 폭을 넓혀 가독성을 높임 */}
        <div className="mt-6 space-y-7">
          <PointHistorySection transactions={transactions} />
          <ReceivedComplimentsSection compliments={receivedCompliments} />
          <EventParticipationSection submissions={eventSubmissions} />
        </div>
      </div>
    </div>
  )
}
