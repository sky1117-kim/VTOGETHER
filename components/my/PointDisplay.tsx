interface PointDisplayProps {
  currentPoints: number
  currentMedals: number
  totalDonated: number
}

export function PointDisplay({ currentPoints, currentMedals, totalDonated }: PointDisplayProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="relative overflow-hidden rounded-2xl border border-[#00b859]/30 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,184,89,0.45)]">
        <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-[#00b859]/20 blur-2xl" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          보유 크레딧
        </p>
        <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          {currentPoints.toLocaleString()} C
        </p>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]">
        <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-slate-200/70 blur-2xl" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          보유 메달
        </p>
        <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          {currentMedals.toLocaleString()} M
        </p>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]">
        <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-slate-200/70 blur-2xl" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          누적 기부액
        </p>
        <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          {totalDonated.toLocaleString()} C
        </p>
      </div>
    </div>
  )
}
