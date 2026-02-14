'use client'

import { useState, useMemo } from 'react'

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

export function PointHistorySection({ transactions }: PointHistorySectionProps) {
  const [filter, setFilter] = useState<'ALL' | 'EARNED' | 'DONATED'>('ALL')

  const filtered = useMemo(() => {
    if (filter === 'ALL') return transactions
    return transactions.filter((t) => t.type === filter)
  }, [transactions, filter])

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-gray-900">포인트 내역</h2>

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
        <div className="space-y-2">
          {filtered.map((t) => {
            const isEarned = t.type === 'EARNED'
            const isDonated = t.type === 'DONATED'
            const displayDesc =
              t.description?.trim() ||
              (isDonated && t.donation_target_name
                ? `${t.donation_target_name}에 기부`
                : TYPE_LABEL[t.type] ?? t.type)
            const amount = t.amount
            const isPlus = amount > 0

            return (
              <div
                key={t.transaction_id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">{displayDesc}</p>
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
      )}
    </div>
  )
}
