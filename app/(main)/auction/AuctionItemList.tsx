'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { placeAuctionBid, type AuctionCategory, type AuctionEventStatus, type AuctionItemForUser } from '@/api/actions/auction'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatIntegerWithCommas, sanitizeIntegerInput } from '@/lib/number-format'

const categoryLabel: Record<AuctionCategory, string> = {
  LAPTOP: '노트북',
  MONITOR: '모니터',
  ETC: '기타',
}

const categoryIcon: Record<AuctionCategory, string> = {
  LAPTOP: '💻',
  MONITOR: '🖥️',
  ETC: '📦',
}

function nextMinBid(item: AuctionItemForUser): number {
  return item.current_highest_bid != null ? item.current_highest_bid + item.min_bid_increment : item.starting_price
}

const SPEC_EMPTY = '미입력'

/** 카테고리별 전체 스펙 항목을 고정 노출한다. 아직 입력 안 된 값은 '미입력'으로 표시한다. */
function buildSpecEntries(item: AuctionItemForUser): Array<{ label: string; value: string }> {
  const entries: Array<{ label: string; value: string }> = []
  entries.push({ label: '모델명', value: item.model_name ?? SPEC_EMPTY })
  if (item.category === 'MONITOR') {
    entries.push({ label: '사이즈', value: item.size ?? SPEC_EMPTY })
  }
  entries.push({ label: '연식/제조년월', value: item.manufacture_date ?? SPEC_EMPTY })
  entries.push({ label: '시리얼번호', value: item.serial_number ?? SPEC_EMPTY })
  if (item.category === 'MONITOR') {
    entries.push({ label: '어답터', value: item.has_adapter == null ? SPEC_EMPTY : item.has_adapter ? '포함' : '미포함' })
  }
  if (item.category === 'LAPTOP') {
    entries.push({ label: '사양', value: item.spec_detail ?? SPEC_EMPTY })
  }
  entries.push({
    label: '기능 특이사항',
    value: item.functional_notes == null ? SPEC_EMPTY : item.functional_notes === '특이사항 없음' ? '없음' : item.functional_notes,
  })
  return entries
}

/** 카드 미리보기용 — 모델명(이미 별도 표시)을 제외하고 실제로 값이 채워진 항목만 노출 */
function buildFilledSpecEntries(item: AuctionItemForUser): Array<{ label: string; value: string }> {
  return buildSpecEntries(item).filter((e) => e.value !== SPEC_EMPTY && e.label !== '모델명')
}

const URGENT_THRESHOLD_MS = 24 * 60 * 60 * 1000

export function AuctionItemList({
  items,
  eventStatus,
  eventEndAt,
}: {
  items: AuctionItemForUser[]
  eventStatus: AuctionEventStatus
  eventEndAt: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AuctionCategory>('ALL')
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [modalImageIndex, setModalImageIndex] = useState(0)
  const [bidTarget, setBidTarget] = useState<AuctionItemForUser | null>(null)
  const [bidAmountInput, setBidAmountInput] = useState('')
  const [isFinalConfirmOpen, setIsFinalConfirmOpen] = useState(false)
  const [bidSuccessInfo, setBidSuccessInfo] = useState<{ name: string; amount: number } | null>(null)
  useBodyScrollLock(!!bidTarget || !!bidSuccessInfo || !!expandedItemId)

  const isUrgent = eventStatus === 'ACTIVE' && new Date(eventEndAt).getTime() - new Date().getTime() <= URGENT_THRESHOLD_MS

  const visibleItems = useMemo(() => {
    if (categoryFilter === 'ALL') return items
    return items.filter((i) => i.category === categoryFilter)
  }, [items, categoryFilter])

  const isClosed = eventStatus !== 'ACTIVE'

  const openBidModal = (item: AuctionItemForUser) => {
    setMessage(null)
    setIsFinalConfirmOpen(false)
    setBidTarget(item)
    setBidAmountInput(String(nextMinBid(item)))
  }

  const requestBidConfirm = () => {
    if (!bidTarget) return
    const amount = Number(sanitizeIntegerInput(bidAmountInput))
    const minRequired = nextMinBid(bidTarget)
    if (!Number.isFinite(amount) || amount < minRequired) {
      setMessage(`최소 ${minRequired.toLocaleString()}원 이상 입력하세요.`)
      return
    }
    if ((amount - bidTarget.starting_price) % bidTarget.min_bid_increment !== 0) {
      setMessage(`입찰가는 ${bidTarget.min_bid_increment.toLocaleString()}원 단위로만 입력할 수 있습니다.`)
      return
    }
    setMessage(null)
    setIsFinalConfirmOpen(true)
  }

  const handleConfirmBid = () => {
    if (!bidTarget) return
    setIsFinalConfirmOpen(false)
    const amount = Number(sanitizeIntegerInput(bidAmountInput))
    const name = bidTarget.name
    startTransition(async () => {
      const result = await placeAuctionBid(bidTarget.item_id, amount)
      if (!result.success) {
        setMessage(result.error ?? '입찰 실패')
        return
      }
      setBidTarget(null)
      setBidSuccessInfo({ name, amount })
      router.refresh()
    })
  }

  const bidAmountValue = Number(sanitizeIntegerInput(bidAmountInput))
  const bidMinRequired = bidTarget ? nextMinBid(bidTarget) : 0

  return (
    <div className="space-y-4">
      {message && !bidTarget && (
        <div className="glass rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-soft">
          {message}
        </div>
      )}
      <section className="animate-fade-up flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-1">
          <span className="px-2 text-[13px] font-bold text-slate-600">분류</span>
          {[
            { key: 'ALL', label: '전체' },
            { key: 'LAPTOP', label: '노트북' },
            { key: 'MONITOR', label: '모니터' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategoryFilter(tab.key as 'ALL' | AuctionCategory)}
              className={`btn-press rounded-lg px-3 py-1.5 text-[13px] font-bold transition ${
                categoryFilter === tab.key
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isUrgent && (
          <span className="inline-flex animate-pulse items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[13px] font-black text-red-600">
            ⏰ 마감 임박! 24시간 이내에 종료됩니다
          </span>
        )}
      </section>

      <div className="animate-fade-up grid items-start gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {visibleItems.map((item, idx) => {
          const disabled = isPending || isClosed || item.already_bid_today
          return (
            <article
              key={item.item_id}
              onClick={() => {
                setExpandedItemId(item.item_id)
                setModalImageIndex(0)
              }}
              className="animate-fade-up flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-white px-2.5 pb-2.5 pt-2.5 shadow-md shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-slate-300/70"
              style={{ animationDelay: `${180 + idx * 60}ms` }}
            >
              <div className="relative mb-2 aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    unoptimized
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                    이미지 준비 중
                  </div>
                )}
                {item.display_order > 0 && (
                  <div className="absolute left-2 top-2 inline-flex items-baseline gap-0.5 rounded-lg bg-slate-900/85 px-2.5 py-1 text-white shadow-sm backdrop-blur-sm">
                    <span className="text-[10px] font-bold tracking-wide text-slate-300">No.</span>
                    <span className="text-[20px] font-black leading-none tabular-nums">{item.display_order}</span>
                  </div>
                )}
                {item.is_current_highest_bidder_me && (
                  <div className="absolute right-2 top-2 rounded-md bg-fuchsia-600/90 px-2 py-1 text-[11px] font-black tracking-wider text-white shadow-sm">
                    최고가 입찰중
                  </div>
                )}
                {item.image_url_2 && (
                  <div className="absolute bottom-2 right-2 inline-flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                    <span aria-hidden>📷</span>2
                  </div>
                )}
              </div>
              <div className="flex h-full flex-col">
                <div className="mb-2">
                  <p className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-slate-500">
                    <span aria-hidden>{categoryIcon[item.category]}</span>
                    {categoryLabel[item.category]}
                  </p>
                  <h3 className="mt-0.5 truncate text-[18px] font-black leading-[1.25] tracking-tight text-slate-900">
                    {item.name}
                  </h3>
                  {item.model_name && <p className="mt-0.5 text-[13px] font-semibold text-slate-600">{item.model_name}</p>}
                </div>
                <div className="mb-2 h-px w-full bg-slate-300/80" />
                {buildFilledSpecEntries(item).length > 0 ? (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {buildFilledSpecEntries(item).map((spec) => (
                      <span
                        key={spec.label}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                      >
                        {spec.label} {spec.value}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mb-4 text-[12px] font-semibold text-slate-400">스펙 정보 준비 중</p>
                )}
                <div className="mb-4 rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold tracking-wide text-slate-600">
                      {item.current_highest_bid != null ? '현재 최고가' : '시작가'}
                    </span>
                    <p className="inline-flex items-baseline gap-1.5 text-emerald-900">
                      <span className="text-[24px] font-black leading-none tracking-tight tabular-nums">
                        {(item.current_highest_bid ?? item.starting_price).toLocaleString()}
                      </span>
                      <span className="text-[12px] font-bold text-slate-600">원</span>
                    </p>
                  </div>
                  <p className="mt-1.5 text-[12px] font-medium text-slate-600">누적 입찰 {item.bid_count}건</p>
                </div>
                {eventStatus === 'CLOSED' && item.winner_name && (
                  <p className="mb-2 text-center text-[13px] font-bold text-emerald-700">
                    낙찰자: {item.winner_name}
                  </p>
                )}
                {eventStatus === 'ACTIVE' && item.already_bid_today && (
                  <p className="mb-2 text-center text-[12px] font-bold tracking-tight text-orange-600">
                    오늘 제출한 입찰가: {(item.my_bid_today_amount ?? 0).toLocaleString()}원 · 내일 다시 시도하세요
                  </p>
                )}
                {eventStatus === 'ACTIVE' && !item.already_bid_today && <div className="mb-2" />}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    openBidModal(item)
                  }}
                  className="mb-0 w-full rounded-xl bg-emerald-600 px-3 py-2 text-[13px] font-extrabold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {eventStatus === 'CLOSED' ? '마감됨' : eventStatus === 'UPCOMING' ? '시작 전' : item.already_bid_today ? '입찰 완료' : isPending ? '처리 중...' : '입찰하기'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {visibleItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm font-semibold text-slate-500">
          조건에 맞는 품목이 없습니다.
        </div>
      )}

      {expandedItemId && (
        <div
          className="animate-modal-backdrop fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/45 p-4 pb-24 pt-20 backdrop-blur-sm sm:items-center sm:pb-4 sm:pt-4"
          onClick={() => setExpandedItemId(null)}
        >
          <div
            className="animate-modal-panel flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const item = visibleItems.find((i) => i.item_id === expandedItemId)
              if (!item) return null
              const disabled = isPending || isClosed || item.already_bid_today
              return (
                <>
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {item.display_order > 0 && (
                          <span className="inline-flex items-baseline gap-0.5 rounded-lg bg-slate-900 px-2.5 py-1 text-white">
                            <span className="text-[10px] font-bold tracking-wide text-slate-300">No.</span>
                            <span className="text-[18px] font-black leading-none tabular-nums">{item.display_order}</span>
                          </span>
                        )}
                        <p className="inline-flex items-center gap-1 text-[12px] font-bold tracking-[0.14em] text-slate-600">
                          <span aria-hidden>{categoryIcon[item.category]}</span>
                          {categoryLabel[item.category]}
                        </p>
                      </div>
                      <h3 className="mt-1 truncate text-lg font-black tracking-tight text-slate-900 sm:text-xl">{item.name}</h3>
                      {item.model_name && <p className="mt-0.5 text-[13px] font-semibold text-slate-600">{item.model_name}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedItemId(null)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-bold leading-none text-slate-600 transition hover:bg-slate-100"
                      aria-label="모달 닫기"
                    >
                      ×
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
                    {(() => {
                      const images = [item.image_url, item.image_url_2].filter((u): u is string => !!u)
                      const activeImage = images[modalImageIndex] ?? images[0] ?? null
                      return (
                        <div className="relative aspect-[4/3] max-h-[60vh] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          {activeImage ? (
                            <Image
                              src={activeImage}
                              alt={item.name}
                              fill
                              sizes="(max-width: 768px) 100vw, 820px"
                              unoptimized
                              className="object-contain"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                              이미지 준비 중
                            </div>
                          )}
                          {images.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setModalImageIndex((i) => (i - 1 + images.length) % images.length)}
                                className="btn-press absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm hover:bg-white"
                                aria-label="이전 사진"
                              >
                                ‹
                              </button>
                              <button
                                type="button"
                                onClick={() => setModalImageIndex((i) => (i + 1) % images.length)}
                                className="btn-press absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm hover:bg-white"
                                aria-label="다음 사진"
                              >
                                ›
                              </button>
                              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                                {images.map((_, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setModalImageIndex(idx)}
                                    className={`h-1.5 w-1.5 rounded-full transition ${
                                      idx === modalImageIndex ? 'bg-emerald-600' : 'bg-white/80'
                                    }`}
                                    aria-label={`사진 ${idx + 1}`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold tracking-wide text-slate-600">
                          {item.current_highest_bid != null ? '현재 최고가' : '시작가'}
                        </span>
                        <p className="inline-flex items-baseline gap-1.5 text-emerald-900">
                          <span className="text-[26px] font-black leading-none tracking-tight tabular-nums">
                            {(item.current_highest_bid ?? item.starting_price).toLocaleString()}
                          </span>
                          <span className="text-[12px] font-bold text-slate-600">원</span>
                        </p>
                      </div>
                      <p className="mt-2 text-[13px] font-medium text-slate-600">
                        누적 입찰 {item.bid_count}건 · 최소 입찰 단위 {item.min_bid_increment.toLocaleString()}원
                      </p>
                      {eventStatus === 'CLOSED' && item.winner_name && (
                        <p className="mt-2 text-[13px] font-bold text-emerald-700">낙찰자: {item.winner_name}</p>
                      )}
                      {eventStatus === 'ACTIVE' && item.already_bid_today && (
                        <p className="mt-2 text-[13px] font-bold text-orange-600">
                          오늘 제출한 입찰가: {(item.my_bid_today_amount ?? 0).toLocaleString()}원 · 내일 다시 시도하세요
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="mb-2 text-[12px] font-bold tracking-wide text-slate-500">상세 스펙</p>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                        {buildSpecEntries(item).map((spec) => (
                          <div key={spec.label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1.5 sm:border-none sm:pb-0">
                            <dt className="shrink-0 text-[12px] font-semibold text-slate-500">{spec.label}</dt>
                            <dd
                              className={`truncate text-right text-[13px] font-bold ${
                                spec.value === SPEC_EMPTY ? 'text-slate-400' : 'text-slate-800'
                              }`}
                            >
                              {spec.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {item.category === 'LAPTOP' && (
                        <p className="mt-2 text-[12px] font-semibold text-amber-700">※ 어답터는 제공되지 않습니다.</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedItemId(null)}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        닫기
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setExpandedItemId(null)
                          openBidModal(item)
                        }}
                        className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {eventStatus === 'CLOSED' ? '마감됨' : eventStatus === 'UPCOMING' ? '시작 전' : item.already_bid_today ? '입찰 완료' : '입찰하기'}
                      </button>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {bidTarget && (
        <div
          className="animate-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => {
            setIsFinalConfirmOpen(false)
            setBidTarget(null)
          }}
        >
          <div
            className="animate-modal-panel w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black tracking-tight text-slate-900">입찰가 입력</h3>
            <p className="mt-1 text-sm text-slate-600">{bidTarget.name}</p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-500">
                  {bidTarget.current_highest_bid != null ? '현재 최고가' : '시작가'}
                </span>
                <span className="font-extrabold text-emerald-800">
                  {(bidTarget.current_highest_bid ?? bidTarget.starting_price).toLocaleString()}원
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[13px] text-slate-600">
                <span>최소 입찰 단위</span>
                <span>{bidTarget.min_bid_increment.toLocaleString()}원</span>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="bid-amount" className="text-sm font-semibold text-slate-700">
                입찰가 (최소 {bidMinRequired.toLocaleString()}원)
              </label>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setBidAmountInput((prev) => {
                      const current = Number(sanitizeIntegerInput(prev)) || bidMinRequired
                      return String(Math.max(bidMinRequired, current - bidTarget.min_bid_increment))
                    })
                  }
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-black text-slate-700 transition hover:bg-slate-100"
                  aria-label="입찰가 감소"
                >
                  -
                </button>
                <input
                  id="bid-amount"
                  type="text"
                  inputMode="numeric"
                  value={formatIntegerWithCommas(bidAmountInput)}
                  onChange={(e) => setBidAmountInput(sanitizeIntegerInput(e.target.value))}
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-center text-sm font-semibold text-slate-800 focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setBidAmountInput((prev) => {
                      const current = Number(sanitizeIntegerInput(prev)) || bidMinRequired
                      return String(Math.max(bidMinRequired, current) + bidTarget.min_bid_increment)
                    })
                  }
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-black text-slate-700 transition hover:bg-slate-100"
                  aria-label="입찰가 증가"
                >
                  +
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((step) => {
                  const amount = bidMinRequired + step * bidTarget.min_bid_increment
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setBidAmountInput(String(amount))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      {amount.toLocaleString()}원
                    </button>
                  )
                })}
              </div>
            </div>

            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">
              품목당 하루 1회만 제출할 수 있어요. 제출 후에는 오늘 다시 바꿀 수 없습니다.
            </p>

            {message && (
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
                {message}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsFinalConfirmOpen(false)
                  setBidTarget(null)
                }}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isPending || !Number.isFinite(bidAmountValue) || bidAmountValue < bidMinRequired}
                onClick={requestBidConfirm}
                className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isPending ? '처리 중...' : '입찰 제출'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isFinalConfirmOpen}
        title="입찰 확인"
        message={
          bidTarget
            ? `${bidTarget.name}에 ${bidAmountValue.toLocaleString()}원으로 입찰합니다.\n제출 후에는 오늘 다시 변경할 수 없습니다. 정말 제출하시겠습니까?`
            : ''
        }
        confirmLabel="제출하기"
        cancelLabel="취소"
        onConfirm={handleConfirmBid}
        onCancel={() => setIsFinalConfirmOpen(false)}
      />

      {bidSuccessInfo && (
        <div
          className="animate-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setBidSuccessInfo(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bid-success-title"
        >
          <div
            className="animate-modal-panel relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="animate-bounce-heart mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-8 w-8 text-emerald-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <h2 id="bid-success-title" className="mb-1 text-center text-lg font-bold text-gray-900">
              입찰 완료!
            </h2>
            <p className="mb-6 text-center text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{bidSuccessInfo.name}</span>에{' '}
              {bidSuccessInfo.amount.toLocaleString()}원으로 입찰했습니다.
            </p>
            <button
              type="button"
              onClick={() => setBidSuccessInfo(null)}
              className="btn-press w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
