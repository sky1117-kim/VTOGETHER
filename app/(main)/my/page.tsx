import { getCurrentUser } from '@/api/actions/auth'
import { getUserDonations } from '@/api/queries/user'
import { LevelBadge } from '@/components/my/LevelBadge'
import { PointDisplay } from '@/components/my/PointDisplay'

export default async function MyPage() {
  const user = await getCurrentUser()

  let donations: Awaited<ReturnType<typeof getUserDonations>> = []
  if (user) {
    try {
      donations = (await getUserDonations(user.id, 10)) ?? []
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {user ? user.name || user.email : '게스트'}
              </h2>
              {user?.dept_name && (
                <p className="mt-1 text-sm text-gray-500">
                  {user.dept_name}
                </p>
              )}
            </div>
            <LevelBadge level={user?.level ?? 'ECO_KEEPER'} size="lg" />
          </div>
        </div>

        <PointDisplay
          currentPoints={user?.current_points ?? 0}
          totalDonated={user?.total_donated_amount ?? 0}
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            최근 기부 내역
          </h2>
          {donations && donations.length > 0 ? (
            <div className="space-y-3">
              {donations.map((donation: { donation_id: string; amount: number; created_at: string; donation_targets?: { name: string } | null }) => (
                <div
                  key={donation.donation_id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-4"
                >
                  <div>
                    <p className="font-bold text-gray-800">
                      {donation.donation_targets?.name || '알 수 없음'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(donation.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-green-600">
                    -{donation.amount.toLocaleString()} P
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">
              아직 기부 내역이 없습니다
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
