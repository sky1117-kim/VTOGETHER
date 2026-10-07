import Link from 'next/link'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { getAuctionEventsForAdmin, getAuctionItemsForAdmin, getAuctionBidsForAdmin } from '@/api/actions/admin/auction'
import { AuctionBidsTable } from './AuctionBidsTable'

export default async function AdminAuctionBidsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const params = await searchParams
  const { data: events, error: eventsError } = await getAuctionEventsForAdmin()
  const eventList = events ?? []
  const selectedEventId = params.event && eventList.some((e) => e.event_id === params.event) ? params.event : eventList[0]?.event_id ?? null

  const [itemsResult, bidsResult] = selectedEventId
    ? await Promise.all([getAuctionItemsForAdmin(selectedEventId), getAuctionBidsForAdmin(selectedEventId)])
    : [{ data: [], error: null }, { data: [], error: null }]

  const selectedEvent = eventList.find((e) => e.event_id === selectedEventId) ?? null
  const now = new Date()
  const isClosed = selectedEvent ? new Date(selectedEvent.end_at) < now : false

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="경매 입찰 내역"
        description="품목별 낙찰(최고가) 현황과 전체 입찰 기록을 확인합니다. 결제·급여 공제 등 정산은 이 목록을 참고해 운영팀이 수동으로 처리합니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '경매 입찰 내역' }]}
      />

      {(eventsError || itemsResult.error || bidsResult.error) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {eventsError || itemsResult.error || bidsResult.error}
        </div>
      )}

      {eventList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {eventList.map((e) => (
            <Link
              key={e.event_id}
              href={`/admin/auction-bids?event=${e.event_id}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                e.event_id === selectedEventId
                  ? 'border-green-500 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {e.title}
            </Link>
          ))}
        </div>
      )}

      {!selectedEvent ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          등록된 경매 이벤트가 없습니다.{' '}
          <Link href="/admin/auction" className="font-semibold text-green-700 hover:underline">
            경매 관리에서 먼저 등록하세요.
          </Link>
        </div>
      ) : (
        <AuctionBidsTable
          eventTitle={selectedEvent.title}
          isClosed={isClosed}
          items={itemsResult.data ?? []}
          bids={bidsResult.data ?? []}
        />
      )}
    </div>
  )
}
