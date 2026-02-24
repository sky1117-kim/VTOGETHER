import { Skeleton } from '@/components/ui/skeleton'

/**
 * 기부 페이지(/donation) 로딩 시 표시할 스켈레톤 UI.
 */
export function DonationPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-56 rounded" />
          <Skeleton className="h-4 w-80 max-w-full rounded" />
        </div>
        <div className="hidden sm:block">
          <Skeleton className="mb-1 h-4 w-24 rounded" />
          <Skeleton className="h-6 w-28 rounded" />
        </div>
      </div>

      <div className="mb-8 rounded-2xl border-2 border-gray-200/80 bg-gray-50/80 p-6">
        <div className="mb-3 flex justify-between">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
        <Skeleton className="h-5 w-full rounded-full" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <Skeleton className="h-40 w-full" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-5 w-28 rounded" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-4/5 rounded-full" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
