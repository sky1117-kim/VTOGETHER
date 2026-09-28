import { getCurrentUser } from '@/api/actions/auth'
import { getMatchingAmountByTarget } from '@/api/actions/admin'
import { getDonationTargets, getTotalDonationStats, getMyPayrollPledges } from '@/api/queries/donation'
import { getDonationFundingType, getDonationBreakdownSegments } from '@/constants/donationTargets'
import { DonationCard } from '@/components/donation/DonationCard'
import { ProgressBar } from '@/components/donation/ProgressBar'

export default async function DonationPage() {
  const user = await getCurrentUser()
  const userPoints = user?.current_points ?? 0

  let targets: Awaited<ReturnType<typeof getDonationTargets>> = []
  let stats = { totalTarget: 40000000, totalCurrent: 0, completedCount: 0, progress: 0 }
  let myPledgesByTarget: Record<string, number> = {}
  try {
    const [targetsRes, statsRes, matchingByTarget, pledgesRes] = await Promise.all([
      getDonationTargets(),
      getTotalDonationStats(),
      getMatchingAmountByTarget(),
      getMyPayrollPledges(user?.id ?? null),
    ])
    const totalMatching = Object.values(matchingByTarget).reduce((sum, v) => sum + v, 0)
    stats = { ...statsRes, totalCurrent: statsRes.totalCurrent + totalMatching }
    targets = (targetsRes ?? []).map((t) => {
      const effectiveAmount = t.current_amount + (matchingByTarget[t.target_id] ?? 0)
      return {
        ...t,
        current_amount: effectiveAmount,
        status: (effectiveAmount >= t.target_amount ? 'COMPLETED' : t.status) as 'ACTIVE' | 'COMPLETED',
      }
    })
    myPledgesByTarget = pledgesRes
  } catch {
    // DB 미설정 시
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-3 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <span className="text-green-600">🤝</span>
            상시 기부 (V.Credit)
          </h1>
          <p className="mt-1 text-gray-500">
            연간 전사 기부 목표 <strong className="text-green-700">4,000만원</strong> 달성 시 상시 기부가 마감됩니다.
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <span className="text-sm text-gray-500">전사 누적 기부액</span>
          <span className="block text-lg font-bold text-green-600">
            ₩ {stats.totalCurrent.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mb-8">
        <ProgressBar
          totalTarget={stats.totalTarget}
          totalCurrent={stats.totalCurrent}
          completedCount={stats.completedCount}
          breakdownSegments={getDonationBreakdownSegments(targets)}
        />
      </div>

      {targets.length > 0 && (
        <div className="space-y-10">
          <div>
            <div className="mb-4 flex items-baseline gap-2.5">
              <span className="h-5 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
              <h2 className="text-base font-bold text-gray-900">일반모금</h2>
              <span className="hidden text-sm text-gray-400 sm:inline">보유한 V.Credit(적립한 V.Medal을 전환한 크레딧 포함)으로 참여</span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {targets
                .filter((target) => getDonationFundingType(target.name) === '일반모금')
                .map((target) => (
                  <DonationCard key={target.target_id} target={target} userPoints={userPoints} />
                ))}
            </div>
          </div>

          {targets.some((target) => getDonationFundingType(target.name) === '특별모금') && (
            <div className="border-t border-gray-100 pt-10">
              <div className="mb-4 flex items-baseline gap-2.5">
                <span className="h-5 w-1 shrink-0 rounded-full bg-slate-500" aria-hidden />
                <h2 className="text-base font-bold text-gray-900">특별모금</h2>
                <span className="hidden text-sm text-gray-400 sm:inline">재난 등 긴급 이슈에 대응해 급여에서 별도로 공제해 참여</span>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {targets
                  .filter((target) => getDonationFundingType(target.name) === '특별모금')
                  .map((target) => (
                    <DonationCard
                      key={target.target_id}
                      target={target}
                      userPoints={userPoints}
                      myPledgeAmount={myPledgesByTarget[target.target_id] ?? 0}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {targets.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">
            등록된 기부처가 없습니다
          </p>
        </div>
      )}
    </div>
  )
}
