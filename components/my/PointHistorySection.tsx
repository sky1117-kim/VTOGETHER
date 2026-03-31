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

export function PointHistorySection({ transactions }: PointHistorySectionProps) {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const [medalFilter, setMedalFilter] = useState<'ALL' | 'EARNED' | 'PURCHASE'>('ALL')
  const [creditFilter, setCreditFilter] = useState<'ALL' | 'EARNED' | 'DONATED'>('ALL')
  const [medalShowAll, setMedalShowAll] = useState(!!highlightId)
  const [creditShowAll, setCreditShowAll] = useState(!!highlightId)

  // 필터 변경 시 더보기 상태 초기화 (highlight 있으면 유지)
  useEffect(() => {
    if (!highlightId) {
      setMedalShowAll(false)
      setCreditShowAll(false)
    }
  }, [medalFilter, creditFilter, highlightId])

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

    const eventSubmissionLink =
      isEarned && t.related_type === 'EVENT' && t.related_id ? (
        <Link
          href={`/my#event-submission-${t.related_id}`}
          className="mt-1 inline-block text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
        >
          인증 제출 내역 보기
        </Link>
      ) : null

    return (
      <div
        id={`transaction-${t.transaction_id}`}
        key={t.transaction_id}
        className={`flex items-center justify-between rounded-xl border px-4 py-3 scroll-mt-24 ${
          highlightId === t.transaction_id ? 'border-green-300 bg-green-50/50' : 'border-gray-100'
        }`}
      >
        <div className="min-w-0 flex-1">
          {isEarned && earnedDisplay?.badge ? (
            <>
              <p className="font-medium text-gray-800">{earnedDisplay.text}</p>
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
            <p className="truncate font-medium text-gray-800">{displayDesc}</p>
          )}
          <p className="text-xs text-gray-500">
            {new Date(t.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {eventSubmissionLink}
        </div>
        <p
          className={`shrink-0 text-lg font-bold ${
            isPlus ? 'text-green-600' : 'text-gray-700'
          }`}
        >
          {isPlus ? '+' : ''}
          {amount.toLocaleString()} {t.currency_type === 'V_MEDAL' ? 'M' : 'C'}
        </p>
      </div>
    )
  }

  return (
    <div id="point-history" className="scroll-mt-6 space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/60 to-white p-6 shadow-sm">
        <h3 className="mb-3 inline-flex items-center gap-2 text-xl font-extrabold text-gray-900">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">V.MEDAL</span>
          V.Medal 내역
        </h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { value: 'ALL' as const, label: '전체' },
            { value: 'EARNED' as const, label: '적립된 내역' },
            { value: 'PURCHASE' as const, label: '구매 내역' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMedalFilter(value)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                medalFilter === value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {medalFiltered.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            {medalFilter === 'ALL' ? 'V.Medal 내역이 없습니다.' : `${medalFilter === 'EARNED' ? '적립된' : '구매'} V.Medal 내역이 없습니다.`}
          </p>
        ) : (
          <>
            <div className="max-h-[320px] space-y-2 overflow-y-auto md:max-h-[400px]">
              {medalDisplayed.map(renderTransactionRow)}
            </div>
            {medalHasMore && !medalShowAll && (
              <button
                type="button"
                onClick={() => setMedalShowAll(true)}
                className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                더보기
              </button>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/60 to-white p-6 shadow-sm">
        <h3 className="mb-3 inline-flex items-center gap-2 text-xl font-extrabold text-gray-900">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">V.CREDIT</span>
          V.Credit 내역
        </h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { value: 'ALL' as const, label: '전체' },
            { value: 'DONATED' as const, label: '기부한 내역' },
            { value: 'EARNED' as const, label: '적립된 내역' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCreditFilter(value)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                creditFilter === value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {creditFiltered.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            {creditFilter === 'ALL' ? 'V.Credit 내역이 없습니다.' : `${TYPE_LABEL[creditFilter]} V.Credit 내역이 없습니다.`}
          </p>
        ) : (
          <>
            <div className="max-h-[320px] space-y-2 overflow-y-auto md:max-h-[400px]">
              {creditDisplayed.map(renderTransactionRow)}
            </div>
            {creditHasMore && !creditShowAll && (
              <button
                type="button"
                onClick={() => setCreditShowAll(true)}
                className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                더보기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
