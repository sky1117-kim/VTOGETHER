import Link from 'next/link'
import { getCurrentUser } from '@/api/actions/auth'
import { getCurrentAuctionEvent } from '@/api/actions/auction'
import { AuctionItemList } from './AuctionItemList'
import { AuctionCountdown } from './AuctionCountdown'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AuctionPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl px-3 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="glass rounded-2xl border border-gray-200 bg-white/90 p-8 text-center shadow-soft">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">RE:Boot 경매</h1>
          <p className="mt-2 text-sm font-medium text-gray-600">로그인 후 경매에 참여할 수 있습니다.</p>
          <Link
            href="/login"
            className="btn-press mt-5 inline-block rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
          >
            로그인하기
          </Link>
        </div>
      </div>
    )
  }

  if (!user.is_admin) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl px-3 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="glass rounded-2xl border border-gray-200 bg-white/90 p-8 text-center shadow-soft">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">RE:Boot 경매</h1>
          <p className="mt-2 text-sm font-medium text-gray-600">
            오픈 준비 중입니다. 곧 찾아뵙겠습니다!
          </p>
        </div>
      </div>
    )
  }

  const { event, items, error } = await getCurrentAuctionEvent()

  return (
    <div className="mx-auto min-w-0 max-w-6xl px-3 pb-12 pt-2 sm:px-6 lg:px-8">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-5 shadow-soft-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-emerald-300/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-bold text-emerald-100">
              V.Together Auction
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">{event?.title ?? 'RE:Boot 경매'}</h1>
            <p className="mt-1.5 text-[14px] font-semibold text-slate-100">
              {event?.description ?? '함께한 물품의 새 주인을 찾고, 수익금은 전액 기부합니다.'}
            </p>
          </div>
          {event && (
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm backdrop-blur sm:items-end">
              <AuctionCountdown startAt={event.start_at} endAt={event.end_at} status={event.status} />
              <span className="text-[13px] font-semibold text-slate-100">
                {formatDateTime(event.start_at)} ~ {formatDateTime(event.end_at)}
              </span>
            </div>
          )}
        </div>
        <div className="relative mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/15 pt-5 text-[13px] font-semibold text-slate-100">
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
            품목당 하루 1회만 입찰 제출 가능
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
            제출 즉시 최고가에 실시간 반영
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
            낙찰 비용은 급여에서 공제될 예정입니다
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {!event || items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center text-gray-500">
          진행 중인 경매가 없습니다.
        </div>
      ) : (
        <AuctionItemList items={items} eventStatus={event.status} eventEndAt={event.end_at} />
      )}
    </div>
  )
}
