import { Skeleton } from '@/components/ui/skeleton'

/**
 * 마이페이지(/my) 로딩 시 표시할 스켈레톤 UI.
 */
export function MyPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Skeleton className="mb-2 h-8 w-32 rounded" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>

      <div className="space-y-6">
        {/* 프로필 카드 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-6 w-40 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-52 rounded" />
                <Skeleton className="h-4 w-36 rounded" />
              </div>
            </div>
            <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
          </div>
        </div>

        {/* 포인트 영역 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>

        {/* 이벤트 참여 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-6 w-28 rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-100 p-4">
                <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* 포인트 내역 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-6 w-24 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                </div>
                <Skeleton className="h-5 w-14 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
