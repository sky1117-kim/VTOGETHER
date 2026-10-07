import { AdminPageHeader } from '../components/AdminPageHeader'
import { getAuctionEventsForAdmin, getAuctionItemsForAdmin } from '@/api/actions/admin/auction'
import { AuctionAdminClient } from './AuctionAdminClient'

export default async function AdminAuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const params = await searchParams
  const { data: events, error: eventsError } = await getAuctionEventsForAdmin()
  const eventList = events ?? []
  const selectedEventId = params.event && eventList.some((e) => e.event_id === params.event) ? params.event : eventList[0]?.event_id ?? null

  const { data: items, error: itemsError } = selectedEventId
    ? await getAuctionItemsForAdmin(selectedEventId)
    : { data: [], error: null }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="경매 관리"
        description="경매 이벤트(기간)를 등록하고, 이벤트별 품목과 현재 최고가를 관리합니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '경매' }]}
      />

      {eventsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{eventsError}</div>
      )}
      {itemsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{itemsError}</div>
      )}

      <AuctionAdminClient events={eventList} items={items ?? []} selectedEventId={selectedEventId} />
    </div>
  )
}
