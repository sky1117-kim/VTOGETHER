'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getEarnedDisplay } from '@/lib/point-display'

export type PointTransactionRow = {
  transaction_id: string
  user_id: string
  type: 'EARNED' | 'DONATED' | 'USED'
  amount: number
  currency_type?: 'V_CREDIT' | 'V_MEDAL'
  related_id: string | null
  related_type: string | null
  description: string | null
  donation_target_name: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = {
  EARNED: '적립',
  DONATED: '기부',
  USED: '사용',
}

interface PointHistorySectionProps {
  transactions: PointTransactionRow[]
}

const INITIAL_SHOW = 10
type MedalFilter = 'ALL' | 'EARNED' | 'PURCHASE'
type CreditFilter = 'ALL' | 'EARNED' | 'DONATED'

export function PointHistorySection({ transactions }: PointHistorySectionProps) {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const [medalFilter, setMedalFilter] = useState<MedalFilter>('ALL')
  const [creditFilter, setCreditFilter] = useState<CreditFilter>('ALL')
  const [medalShowAll, setMedalShowAll] = useState(!!highlightId)
  const [creditShowAll, setCreditShowAll] = useState(!!highlightId)

  // highlight 건이 있으면 해당 건으로 스크롤
  useEffect(() => {
    if (highlightId && typeof document !== 'undefined') {
      const el = document.getElementById(`transaction-${highlightId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId])

  // V.Medal: 적립/구매 필터
  const medalFiltered = useMemo(() => {
    const medalTx = transactions.filter((t) => t.currency_type === 'V_MEDAL')
    if (medalFilter === 'ALL') return medalTx
    if (medalFilter === 'EARNED') return medalTx.filter((t) => t.type === 'EARNED')
    return medalTx.filter((t) =>
      t.type === 'USED' || (t.description?.includes('구매') ?? false)
    )
  }, [transactions, medalFilter])

  // V.Credit: 적립/기부 필터
  const creditFiltered = useMemo(() => {
    const creditTx = transactions.filter((t) => t.currency_type !== 'V_MEDAL')
    if (creditFilter === 'ALL') return creditTx
    return creditTx.filter((t) => t.type === creditFilter)
  }, [transactions, creditFilter])

  const medalDisplayed = medalShowAll ? medalFiltered : medalFiltered.slice(0, INITIAL_SHOW)
  const creditDisplayed = creditShowAll ? creditFiltered : creditFiltered.slice(0, INITIAL_SHOW)
  const medalHasMore = medalFiltered.length > INITIAL_SHOW
  const creditHasMore = creditFiltered.length > INITIAL_SHOW
  const filterBaseClass = 'rounded-xl px-4 py-2 text-sm font-semibold transition'
  const filterActiveClass = 'bg-slate-900 text-white shadow-sm'
  const filterInactiveClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200'

  const renderTransactionRow = (t: PointTransactionRow) => {
    const isEarned = t.type === 'EARNED'
    const isDonated = t.type === 'DONATED'
    const displayDesc =
      t.description?.trim() ||
      (isDonated && t.donation_target_name
        ? `${t.donation_target_name}에 기부`
        : TYPE_LABEL[t.type] ?? t.type)
    const amount = t.amount
    const isPlus = amount > 0
    const earnedDisplay = isEarned ? getEarnedDisplay(t.description) : null
    const isComplimentReceived = isEarned && earnedDisplay?.variant === 'received'

    const complimentReceivedLink =
      isComplimentReceived ? (
        <Link
          href="/my#received-compliments"
          className="mt-1 inline-block text-xs font-semibold text-violet-700 underline-offset-2 hover:underline"
        >
          받은 칭찬 내용 보기
        </Link>
      ) : null

    const eventSubmissionLink =
      isEarned && t.related_type === 'EVENT' && t.related_id && !isComplimentReceived ? (
        <Link
          href={`/my#event-submission-${t.related_id}`}
          className="mt-1 inline-block text-xs font-semibold text-[#00b859] underline-offset-2 hover:underline"
        >
          인증 제출 내역 보기
        </Link>
      ) : null

    return (
      <div
        id={`transaction-${t.transaction_id}`}
        key={t.transaction_id}
        className={`flex items-center justify-between rounded-xl border px-4 py-3 scroll-mt-24 ${
          highlightId === t.transaction_id
            ? 'border-[#00b859]/40 bg-[#00b859]/10'
            : 'border-slate-100 bg-white'
        }`}
      >
        <div className="min-w-0 flex-1">
          {isEarned && earnedDisplay?.badge ? (
            <>
              <p className="font-semibold text-slate-800">{earnedDisplay.text}</p>
              <span
                className={`mt-0.5 inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  earnedDisplay.variant === 'received'
                    ? 'bg-violet-100 text-violet-700'
                    : earnedDisplay.variant === 'gave'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-green-100 text-green-700'
                }`}
              >
                {earnedDisplay.badge}
              </span>
            </>
          ) : (
            <p className="truncate font-semibold text-slate-800">{displayDesc}</p>
          )}
          <p className="text-xs text-slate-500">
            {new Date(t.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {complimentReceivedLink}
          {eventSubmissionLink}
        </div>
        <p
          className={`shrink-0 text-lg font-extrabold ${
            isPlus ? 'text-[#00b859]' : 'text-slate-700'
          }`}
        >
          {isPlus ? '+' : ''}
          {amount.toLocaleString()} {t.currency_type === 'V_MEDAL' ? 'M' : 'C'}
        </p>
      </div>
    )
  }

  const renderCard = ({
    title,
    badge,
    badgeClassName,
    filter,
    setFilter,
    filterOptions,
    emptyText,
    displayedRows,
    hasMore,
    onShowAll,
  }: {
    title: string
    badge: string
    badgeClassName: string
    filter: string
    setFilter: (value: string) => void
    filterOptions: { value: string; label: string }[]
    emptyText: string
    displayedRows: PointTransactionRow[]
    hasMore: boolean
    onShowAll: () => void
  }) => (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-28px_rgba(2,6,23,0.55)]">
      <h3 className="mb-3 inline-flex items-center gap-2 text-xl font-black text-slate-900">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeClassName}`}>{badge}</span>
        {title}
      </h3>
      <div className="mb-4 flex flex-wrap gap-2">
        {filterOptions.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`${filterBaseClass} ${filter === value ? filterActiveClass : filterInactiveClass}`}
          >
            {label}
          </button>
        ))}
      </div>
      {displayedRows.length === 0 ? (
        <p className="py-8 text-center text-slate-500">{emptyText}</p>
      ) : (
        <>
          <div className="max-h-[320px] space-y-2 overflow-y-auto md:max-h-[420px]">
            {displayedRows.map(renderTransactionRow)}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={onShowAll}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              더보기
            </button>
          )}
        </>
      )}
    </div>
  )

  return (
    <div id="point-history" className="scroll-mt-6">
      <div className="mb-4">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">포인트 내역</h2>
        <p className="mt-1 text-sm text-slate-500">V.Medal, V.Credit 적립/사용 기록을 확인할 수 있습니다.</p>
      </div>
      <div className="grid gap-4 2xl:grid-cols-2">
        {renderCard({
          title: 'V.Medal 내역',
          badge: 'V.MEDAL',
          badgeClassName: 'bg-[#00b859]/15 text-[#00b859]',
          filter: medalFilter,
          setFilter: (value) => {
            setMedalFilter(value as MedalFilter)
            if (!highlightId) setMedalShowAll(false)
          },
          filterOptions: [
            { value: 'ALL' as const, label: '전체' },
            { value: 'EARNED' as const, label: '적립된 내역' },
            { value: 'PURCHASE' as const, label: '구매 내역' },
          ],
          emptyText:
            medalFilter === 'ALL'
              ? 'V.Medal 내역이 없습니다.'
              : `${medalFilter === 'EARNED' ? '적립된' : '구매'} V.Medal 내역이 없습니다.`,
          displayedRows: medalDisplayed,
          hasMore: medalHasMore && !medalShowAll,
          onShowAll: () => setMedalShowAll(true),
        })}

        {renderCard({
          title: 'V.Credit 내역',
          badge: 'V.CREDIT',
          badgeClassName: 'bg-amber-100 text-amber-700',
          filter: creditFilter,
          setFilter: (value) => {
            setCreditFilter(value as CreditFilter)
            if (!highlightId) setCreditShowAll(false)
          },
          filterOptions: [
            { value: 'ALL' as const, label: '전체' },
            { value: 'DONATED' as const, label: '기부한 내역' },
            { value: 'EARNED' as const, label: '적립된 내역' },
          ],
          emptyText:
            creditFilter === 'ALL'
              ? 'V.Credit 내역이 없습니다.'
              : `${TYPE_LABEL[creditFilter]} V.Credit 내역이 없습니다.`,
          displayedRows: creditDisplayed,
          hasMore: creditHasMore && !creditShowAll,
          onShowAll: () => setCreditShowAll(true),
        })}
      </div>
    </div>
  )
}
