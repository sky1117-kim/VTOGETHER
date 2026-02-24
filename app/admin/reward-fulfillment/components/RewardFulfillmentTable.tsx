'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { NonPointRewardRow } from '@/api/actions/admin'
import { setRewardFulfillment } from '@/api/actions/admin'

const REWARD_TYPE_LABEL: Record<string, string> = {
  COFFEE_COUPON: '커피 쿠폰',
  GOODS: '굿즈',
  COUPON: '쿠폰',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type FilterType = 'all' | 'pending' | 'fulfilled'

interface RewardFulfillmentTableProps {
  rows: NonPointRewardRow[]
  currentFilter: FilterType
  currentEventId: string | null
}

export function RewardFulfillmentTable({
  rows,
  currentFilter,
  currentEventId,
}: RewardFulfillmentTableProps) {
  const router = useRouter()

  const buildFilterUrl = (filter: FilterType) => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('filter', filter)
    if (currentEventId) params.set('eventId', currentEventId)
    const qs = params.toString()
    return `/admin/reward-fulfillment${qs ? `?${qs}` : ''}`
  }

  async function handleToggle(submissionId: string, currentlyFulfilled: boolean) {
    const { success, error } = await setRewardFulfillment(submissionId, !currentlyFulfilled)
    if (success) router.refresh()
    else if (error) alert(error)
  }

  return (
    <div className="space-y-4">
      {/* 상태 필터 탭 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-600">보기:</span>
        {[
          { value: 'all' as const, label: '전체' },
          { value: 'pending' as const, label: '미발송' },
          { value: 'fulfilled' as const, label: '발송 완료' },
        ].map(({ value, label }) => (
          <Link
            key={value}
            href={buildFilterUrl(value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
              currentFilter === value
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </Link>
        ))}
        <span className="text-xs text-gray-500">총 {rows.length}건</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  발송 완료
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  이벤트
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  구간
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  참여자
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  이메일
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  선택 보상
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  선택 일시
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rows.map((r) => {
                const fulfilled = !!r.fulfilled_at
                return (
                  <tr key={r.submission_id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={fulfilled}
                          onChange={() => handleToggle(r.submission_id, fulfilled)}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-500">
                          {fulfilled ? '완료' : '대기'}
                        </span>
                      </label>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {r.event_title}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {r.round_number != null ? `${r.round_number}구간` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {r.user_name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      <a href={`mailto:${r.user_email ?? ''}`} className="text-green-600 hover:underline">
                        {r.user_email ?? '—'}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        {REWARD_TYPE_LABEL[r.reward_type] ?? r.reward_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDate(r.chosen_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
