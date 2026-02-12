import { getCurrentUser } from '@/api/actions/auth'
import { getDonationTargets, getTotalDonationStats } from '@/api/queries/donation'
import { DonationCard } from '@/components/donation/DonationCard'
import { ProgressBar } from '@/components/donation/ProgressBar'

export default async function DonationPage() {
  const user = await getCurrentUser()
  const userPoints = user?.current_points ?? 0

  let targets: Awaited<ReturnType<typeof getDonationTargets>> = []
  let stats = { totalTarget: 40000000, totalCurrent: 0, completedCount: 0, progress: 0 }
  try {
    targets = (await getDonationTargets()) ?? []
    stats = await getTotalDonationStats()
  } catch {
    // DB 미설정 시
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <span className="text-green-600">🤝</span>
            상시 기부 (V.Point)
          </h1>
          <p className="mt-1 text-gray-500">
            기부처별 목표 <strong className="text-green-700">1,000만원</strong> 달성 시 해당 모금은 마감됩니다.
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
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {targets.map((target) => (
          <DonationCard key={target.target_id} target={target} userPoints={userPoints} />
        ))}
      </div>

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
