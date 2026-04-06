import Link from 'next/link'
import { getDonationTargetDisplayName } from '@/constants/donationTargets'

interface RecentDonation {
  donation_id: string
  amount: number
  created_at: string
  donation_targets: {
    name: string
  } | null
}

interface RecentDonationsProps {
  donations: RecentDonation[]
}

export function RecentDonations({ donations }: RecentDonationsProps) {
  if (!donations || donations.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
          최근 기부 내역
        </h2>
        <p className="text-center text-zinc-500 dark:text-zinc-400">
          아직 기부 내역이 없습니다
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          최근 기부 내역
        </h2>
        <Link
          href="/donation"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          전체 보기 →
        </Link>
      </div>
      <div className="space-y-3">
        {donations.map((donation) => (
          <div
            key={donation.donation_id}
            className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"
          >
            <div>
              <p className="font-medium text-black dark:text-zinc-50">
                {donation.donation_targets?.name
                  ? getDonationTargetDisplayName(donation.donation_targets.name)
                  : '알 수 없음'}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {new Date(donation.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              -{donation.amount.toLocaleString()} C
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
