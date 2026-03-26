interface PointDisplayProps {
  currentPoints: number
  currentMedals: number
  totalDonated: number
}

export function PointDisplay({ currentPoints, currentMedals, totalDonated }: PointDisplayProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/60 to-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          보유 크레딧
        </p>
        <p className="mt-2 text-2xl font-bold text-gray-900">
          {currentPoints.toLocaleString()} C
        </p>
      </div>
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/60 to-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          보유 메달
        </p>
        <p className="mt-2 text-2xl font-bold text-gray-900">
          {currentMedals.toLocaleString()} M
        </p>
      </div>
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/60 to-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          누적 기부액
        </p>
        <p className="mt-2 text-2xl font-bold text-gray-900">
          {totalDonated.toLocaleString()} C
        </p>
      </div>
    </div>
  )
}
