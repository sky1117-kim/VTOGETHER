import type { DonationBreakdownSegment } from '@/constants/donationTargets'

interface ProgressBarProps {
  totalTarget: number
  totalCurrent: number
  completedCount: number
  breakdownSegments?: DonationBreakdownSegment[]
}

export function ProgressBar({ totalTarget, totalCurrent, completedCount, breakdownSegments = [] }: ProgressBarProps) {
  const progress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
            전사 누적 기부액
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-3xl font-bold tabular-nums tracking-tight text-gray-900">
              {totalCurrent.toLocaleString()}
            </h3>
            <span className="text-sm text-gray-400">
              / {totalTarget.toLocaleString()}원
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold tabular-nums text-emerald-600">
            {Math.round(progress)}%
          </span>
          <span className="block text-xs text-gray-400">
            {completedCount}개 기부처 마감
          </span>
        </div>
      </div>
      <div className="flex h-4 w-full gap-[3px] overflow-hidden rounded-full bg-gray-100">
        {breakdownSegments.map((seg) => (
          <div
            key={seg.key}
            className={`h-full ${seg.colorClass} transition-[width] duration-500`}
            style={{ width: `${totalTarget > 0 ? (seg.amount / totalTarget) * 100 : 0}%` }}
            title={`${seg.label} · ${seg.amount.toLocaleString()}원`}
          />
        ))}
      </div>
      {breakdownSegments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {breakdownSegments.map((seg) => (
            <span key={seg.key} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`h-2 w-2 shrink-0 rounded-full ${seg.colorClass}`} aria-hidden />
              {seg.label}
              <span className="font-semibold tabular-nums text-gray-700">{seg.amount.toLocaleString()}원</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
