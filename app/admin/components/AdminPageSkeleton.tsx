import { Skeleton } from '@/components/ui/skeleton'

/** 관리자 하위 페이지 공용 로딩 스켈레톤 (제목 + 필터 + 표) */
export function AdminPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="불러오는 중">
      <div>
        <Skeleton className="mb-2 h-8 w-40 rounded" />
        <Skeleton className="h-4 w-80 max-w-full rounded" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <Skeleton className="h-4 w-full rounded" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 flex-1 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
