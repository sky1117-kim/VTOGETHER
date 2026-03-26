interface ProgressBarProps {
  totalTarget: number
  totalCurrent: number
  completedCount: number
}

export function ProgressBar({ totalTarget, totalCurrent, completedCount }: ProgressBarProps) {
  const progress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <span className="text-xs font-bold uppercase text-gray-500">
            Total Progress (All Targets)
          </span>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-gray-900">
              {totalCurrent.toLocaleString()}
            </h3>
            <span className="text-sm text-gray-400">
              / {totalTarget.toLocaleString()} C
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-green-600">
            {Math.round(progress)}%
          </span>
          <span className="block text-xs text-gray-400">
            {completedCount}개 목표 달성
          </span>
        </div>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="progress-bar h-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 shadow-inner"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  )
}
