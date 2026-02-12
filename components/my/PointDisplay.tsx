interface PointDisplayProps {
  currentPoints: number
  totalDonated: number
}

export function PointDisplay({ currentPoints, totalDonated }: PointDisplayProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          보유 포인트
        </p>
        <p className="mt-2 text-2xl font-bold text-gray-900">
          {currentPoints.toLocaleString()} P
        </p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          누적 기부액
        </p>
        <p className="mt-2 text-2xl font-bold text-gray-900">
          {totalDonated.toLocaleString()} P
        </p>
      </div>
    </div>
  )
}
