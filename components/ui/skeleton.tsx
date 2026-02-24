import * as React from 'react'

/**
 * 로딩 시 콘텐츠 자리 표시용 스켈레톤 컴포넌트.
 * Shadcn UI 스타일 + animate-pulse로 시각적 피드백 제공.
 */
function Skeleton({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200/80 ${className}`}
      {...props}
    />
  )
}

export { Skeleton }
