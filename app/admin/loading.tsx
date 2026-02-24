import { Skeleton } from '@/components/ui/skeleton'

/** 관리자 대시보드 로딩 시 표시되는 스켈레톤 */
export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-2 h-8 w-28 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-6 w-12 rounded" />
            </div>
            <Skeleton className="h-5 w-5 shrink-0 rounded" />
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="min-h-[300px] rounded-xl" />
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="min-h-[300px] rounded-xl" />
        <Skeleton className="min-h-[400px] rounded-xl" />
      </div>
    </div>
  )
}
