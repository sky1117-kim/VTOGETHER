'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Store, User } from 'lucide-react'

const navigationItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/shop', label: '상점', icon: Store },
  { href: '/my', label: '마이페이지', icon: User },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/20 bg-white/80 shadow-soft backdrop-blur-xl pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden">
      <div className="flex items-stretch justify-between gap-0.5 px-1 py-1.5">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          // 짧은 라벨: 좁은 기기에서 줄바꿈·넘침 방지
          const shortLabel =
            item.href === '/my' ? '마이' : item.href === '/shop' ? '상점' : item.label
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-semibold leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press-link sm:text-xs ${
                isActive
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span>{shortLabel}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
