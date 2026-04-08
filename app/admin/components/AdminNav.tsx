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
  CircleDollarSign,
  Store,
  ShoppingBag,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, badgeKey: null },
  { href: '/admin/point-grant', label: '지급/적립 내역', icon: CircleDollarSign, badgeKey: null },
  { href: '/admin/events', label: '이벤트', icon: Gift, badgeKey: null },
  { href: '/admin/shop-products', label: '상점 상품', icon: Store, badgeKey: null },
  { href: '/admin/shop-orders', label: '상점 주문', icon: ShoppingBag, badgeKey: null },
  { href: '/admin/verifications', label: '인증 심사', icon: ClipboardCheck, badgeKey: 'verification' as const },
  { href: '/admin/reward-fulfillment', label: '쿠폰/굿즈 발송', icon: Package, badgeKey: null },
  { href: '/admin/donation-targets', label: '기부처', icon: Heart, badgeKey: null },
  { href: '/admin/recent-users', label: '최근 접속 사용자', icon: Users, badgeKey: null },
] as const

interface AdminNavProps {
  /** 데스크톱: 세로, 모바일: 가로 */
  orientation?: 'vertical' | 'horizontal'
  /** 이벤트 인증 대기 건수 */
  pendingVerificationCount?: number
  /** 건강 챌린지 활동 대기 건수 (인증 심사 배지에 합산) */
  pendingHealthCount?: number
}

export function AdminNav({
  orientation = 'vertical',
  pendingVerificationCount = 0,
  pendingHealthCount = 0,
}: AdminNavProps) {
  const pathname = usePathname()
  const isHorizontal = orientation === 'horizontal'

  return (
    <nav
      className={`flex gap-1 ${isHorizontal ? 'flex-row overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin' : 'flex-col'}`}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon, badgeKey }) => {
        const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
        const count =
          badgeKey === 'verification'
            ? pendingVerificationCount + pendingHealthCount
            : 0
        const badge = badgeKey != null && count > 0
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press-link ${
              isHorizontal ? 'shrink-0 pr-4 border border-gray-200 bg-white' : ''
            } ${
              isActive
                ? 'bg-green-50 text-green-800 ring-1 ring-green-200'
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
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        )
      })}
      {isHorizontal && <span className="shrink-0 w-2" aria-hidden />}
    </nav>
  )
}
