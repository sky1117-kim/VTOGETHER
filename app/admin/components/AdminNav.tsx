'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Gift,
  ClipboardCheck,
  Package,
  Heart,
  Users,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, showBadge: false },
  { href: '/admin/events', label: '이벤트', icon: Gift, showBadge: false },
  { href: '/admin/verifications', label: '인증 심사', icon: ClipboardCheck, showBadge: true },
  { href: '/admin/reward-fulfillment', label: '쿠폰/굿즈 발송', icon: Package, showBadge: false },
  { href: '/admin/donation-targets', label: '기부처', icon: Heart, showBadge: false },
  { href: '/admin/recent-users', label: '최근 접속 사용자', icon: Users, showBadge: false },
] as const

interface AdminNavProps {
  /** 데스크톱: 세로, 모바일: 가로 */
  orientation?: 'vertical' | 'horizontal'
  /** 인증 심사 승인 대기 건수 (배지 표시용) */
  pendingCount?: number
}

export function AdminNav({ orientation = 'vertical', pendingCount = 0 }: AdminNavProps) {
  const pathname = usePathname()
  const isHorizontal = orientation === 'horizontal'

  return (
    <nav
      className={`flex gap-1 ${isHorizontal ? 'flex-row overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin' : 'flex-col'}`}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon, showBadge }) => {
        const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
        const badge = showBadge && pendingCount > 0
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press-link ${
              isHorizontal ? 'shrink-0 pr-4' : ''
            } ${
              isActive
                ? 'bg-green-100 text-green-800'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon
              className={`size-4 shrink-0 ${isActive ? 'text-green-600' : 'text-gray-500 group-hover:text-gray-700'}`}
              aria-hidden
            />
            <span className="min-w-0 truncate">{label}</span>
            {badge && (
              <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </Link>
        )
      })}
      {isHorizontal && <span className="shrink-0 w-2" aria-hidden />}
    </nav>
  )
}
