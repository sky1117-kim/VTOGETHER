import { Skeleton } from '@/components/ui/skeleton'

/**
 * 메인(홈) 페이지 로딩 시 표시할 스켈레톤 UI.
 * 실제 레이아웃(대시보드·기부·캠페인·급여기부·명예의전당)과 유사한 형태로 배치.
 */
export function HomePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-2 sm:px-6 lg:px-8">
      {/* 대시보드 영역: 히어로 카드 + My Status 카드 */}
      <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* 히어로 카드 (2/3) */}
        <div className="flex min-h-[280px] overflow-hidden rounded-3xl bg-gray-200/80 lg:col-span-2">
          <div className="flex w-full flex-col justify-center p-10 lg:p-12">
            <Skeleton className="mb-5 h-6 w-32 rounded-full" />
            <Skeleton className="mb-4 h-10 w-3/4 max-w-md rounded-lg" />
            <Skeleton className="mb-2 h-6 w-full max-w-sm rounded" />
            <Skeleton className="h-6 w-2/3 max-w-xs rounded" />
          </div>
        </div>
        {/* My Status 카드 (1/3) */}
        <div className="flex max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-lg">
          <div className="h-28 rounded-t-3xl bg-gray-300/80 px-4 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-14 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-6 w-24 rounded" />
                <Skeleton className="h-4 w-36 rounded" />
              </div>
            </div>
          </div>
          <div className="relative -mt-6 mx-4">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <div className="space-y-3 p-4 pt-6">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </div>
      </section>

      {/* 상시 기부 섹션 */}
      <section className="mb-16 mt-8">
        <div className="mb-6">
          <Skeleton className="mb-2 h-8 w-48 rounded" />
          <Skeleton className="h-4 w-72 max-w-full rounded" />
        </div>
        <div className="mb-8 rounded-2xl border-2 border-gray-200/80 bg-gray-50/80 p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap justify-between gap-4">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-10 w-24 rounded" />
          </div>
          <Skeleton className="mb-2 h-12 w-full rounded-lg" />
          <Skeleton className="h-5 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <Skeleton className="h-40 w-full rounded-t-2xl" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-9 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 캠페인 섹션 */}
      <section className="mb-16 mt-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Skeleton className="h-8 w-56 rounded" />
          <Skeleton className="h-11 w-48 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-5">
              <Skeleton className="mb-3 h-36 w-full rounded-xl" />
              <Skeleton className="mb-2 h-5 w-3/4 rounded" />
              <Skeleton className="mb-3 h-4 w-full rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </section>

      {/* 급여 기부 섹션 */}
      <section className="mb-16 mt-8">
        <div className="mb-6">
          <Skeleton className="mb-2 h-8 w-40 rounded" />
          <Skeleton className="h-4 w-80 max-w-full rounded" />
        </div>
        <div className="flex flex-col gap-6 rounded-3xl border border-gray-200/80 bg-white p-8 md:flex-row md:items-center">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl md:w-56" />
        </div>
      </section>

      {/* V.Honors 섹션 */}
      <section className="mb-16 mt-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Skeleton className="h-8 w-52 rounded" />
          <Skeleton className="h-11 w-40 rounded-xl" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white">
          <div className="border-b border-gray-100 bg-gray-50/80 px-6 py-4">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="ml-auto h-4 w-24 rounded" />
            </div>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-0"
            >
              <Skeleton className="h-6 w-8 rounded" />
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="ml-auto h-5 w-20 rounded" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
