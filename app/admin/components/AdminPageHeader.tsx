import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface AdminPageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  /** 오른쪽 액션 영역 (버튼 등) */
  actions?: React.ReactNode
}

/** 관리자 페이지 공통 헤더: 제목, 설명, breadcrumb, 액션 버튼 */
export function AdminPageHeader({
  title,
  description,
  breadcrumbs = [{ label: '관리자', href: '/admin' }],
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {breadcrumbs.length > 0 && (
          <nav className="mb-2 flex items-center gap-1 text-sm text-gray-500" aria-label="Breadcrumb">
            {breadcrumbs.map((item, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-4 shrink-0 text-gray-300" aria-hidden />}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-medium text-gray-700">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
