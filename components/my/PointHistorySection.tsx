'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getEarnedDisplay } from '@/lib/point-display'

export type PointTransactionRow = {
  transaction_id: string
  user_id: string
  type: 'EARNED' | 'DONATED' | 'USED'
  amount: number
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
  const [filter, setFilter] = useState<'ALL' | 'EARNED' | 'DONATED'>('ALL')
  const [showAll, setShowAll] = useState(!!highlightId)

  // 필터 변경 시 더보기 상태 초기화 (highlight 있으면 유지)
  useEffect(() => {
    if (!highlightId) setShowAll(false)
  }, [filter, highlightId])

  // highlight 건이 있으면 해당 건으로 스크롤
  useEffect(() => {
    if (highlightId && typeof document !== 'undefined') {
      const el = document.getElementById(`transaction-${highlightId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId])

  const filtered = useMemo(() => {
    if (filter === 'ALL') return transactions
    return transactions.filter((t) => t.type === filter)
  }, [transactions, filter])

  const displayed = showAll ? filtered : filtered.slice(0, INITIAL_SHOW)
  const hasMore = filtered.length > INITIAL_SHOW

  return (
    <div id="point-history" className="scroll-mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-gray-900">포인트 내역</h2>
      <p className="mb-4 text-sm text-gray-500">
        칭찬 챌린지 적립 건의 칭찬 내용은 아래 &apos;받은 칭찬&apos; 섹션에서 확인할 수 있습니다.
      </p>

      {/* 필터: 전체 / 기부한 내역 / 적립된 내역 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { value: 'ALL' as const, label: '전체' },
          { value: 'DONATED' as const, label: '기부한 내역' },
          { value: 'EARNED' as const, label: '적립된 내역' },
        ].map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              filter === value
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-gray-500">
          {filter === 'ALL' ? '아직 포인트 내역이 없습니다.' : `${TYPE_LABEL[filter]} 내역이 없습니다.`}
        </p>
      ) : (
        <>
          <div className="max-h-[320px] space-y-2 overflow-y-auto md:max-h-[400px]">
            {displayed.map((t) => {
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
                </div>
                <p
                  className={`shrink-0 text-lg font-bold ${
                    isPlus ? 'text-green-600' : 'text-gray-700'
                  }`}
                >
                  {isPlus ? '+' : ''}
                  {amount.toLocaleString()} P
                </p>
              </div>
            )
          })}
          </div>
          {hasMore && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              더보기 ({filtered.length - INITIAL_SHOW}건)
            </button>
          )}
        </>
      )}
    </div>
  )
}
