'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/events', label: '이벤트' },
  { href: '/admin/verifications', label: '인증 심사' },
  { href: '/admin/donation-targets', label: '기부처' },
] as const

interface AdminNavProps {
  /** 데스크톱: 세로, 모바일: 가로 */
  orientation?: 'vertical' | 'horizontal'
}

export function AdminNav({ orientation = 'vertical' }: AdminNavProps) {
  const pathname = usePathname()
  const isHorizontal = orientation === 'horizontal'

  return (
    <nav className={`flex gap-1 ${isHorizontal ? 'flex-row overflow-x-auto' : 'flex-col'}`}>
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${isHorizontal ? 'whitespace-nowrap' : ''} ${
              isActive ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
