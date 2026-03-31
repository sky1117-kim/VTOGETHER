import { Skeleton } from '@/components/ui/skeleton'

/**
 * 마이페이지(/my) 로딩 시 표시할 스켈레톤 UI.
 */
export function MyPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-[#00b859]/[0.08]">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-slate-300 bg-slate-200/60 p-6">
          <Skeleton className="mb-2 h-6 w-36 rounded" />
          <Skeleton className="h-10 w-52 rounded" />
          <Skeleton className="mt-2 h-4 w-72 rounded" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <Skeleton className="mb-3 h-8 w-56 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
          <Skeleton className="mt-2 h-4 w-40 rounded" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <Skeleton className="h-8 w-36 rounded" />
              <Skeleton className="mt-2 h-4 w-72 rounded" />
              <div className="mt-4 grid gap-4 2xl:grid-cols-2">
                <Skeleton className="h-80 rounded-2xl" />
                <Skeleton className="h-80 rounded-2xl" />
              </div>
            </div>
          </div>
          <div className="space-y-6 xl:col-span-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <Skeleton className="h-6 w-44 rounded" />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <Skeleton className="h-6 w-40 rounded" />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
