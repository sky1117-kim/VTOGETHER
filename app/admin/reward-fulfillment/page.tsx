import Link from 'next/link'
import { AdminPageHeader } from '../components/AdminPageHeader'
import {
  getNonPointRewardFulfillmentList,
  getEventsForRewardFulfillment,
  type RewardFulfillmentFilter,
} from '@/api/actions/admin'
import { RewardFulfillmentTable } from './components/RewardFulfillmentTable'
import { EventFilterSelect } from './components/EventFilterSelect'

export default async function AdminRewardFulfillmentPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; eventId?: string }>
}) {
  const { filter, eventId } = await searchParams
  const safeFilter: RewardFulfillmentFilter =
    filter === 'pending' || filter === 'fulfilled' ? filter : 'all'

  const [{ data: rows, error }, { data: events }] = await Promise.all([
    getNonPointRewardFulfillmentList(safeFilter, eventId || null),
    getEventsForRewardFulfillment(),
  ])

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="쿠폰 / 굿즈 발송 대상"
        description="보상 선택에서 커피 쿠폰·굿즈를 고른 참여자 목록입니다. 발송 완료 시 체크해 두세요."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '쿠폰/굿즈 발송' }]}
        actions={
          <>
            <Link
              href="/admin/events"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              이벤트 관리
            </Link>
            <Link
              href="/admin/verifications"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              인증 심사
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              대시보드로
            </Link>
          </>
        }
      />

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* 이벤트 필터: 쿠폰/굿즈 대상이 있으면 표시 (API 이벤트 목록 또는 rows에서 추출) */}
      {((events?.length ?? 0) > 0 || (rows?.length ?? 0) > 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <EventFilterSelect
            events={
              (events?.length ?? 0) > 0
                ? events!
                : (rows ?? []).reduce(
                    (acc: { event_id: string; title: string }[], r) => {
                      if (!acc.some((e) => e.event_id === r.event_id))
                        acc.push({ event_id: r.event_id, title: r.event_title })
                      return acc
                    },
                    []
                  )
            }
            currentEventId={eventId ?? null}
            currentFilter={safeFilter}
          />
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          {safeFilter === 'all'
            ? '아직 쿠폰/굿즈를 선택한 건이 없습니다.'
            : safeFilter === 'pending'
              ? '미발송 건이 없습니다.'
              : '발송 완료한 건이 없습니다.'}
        </div>
      )}

      {rows && rows.length > 0 && (
        <RewardFulfillmentTable
          rows={rows}
          currentFilter={safeFilter}
          currentEventId={eventId ?? null}
        />
      )}
    </div>
  )
}
