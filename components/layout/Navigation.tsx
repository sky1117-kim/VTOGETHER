'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Heart, User } from 'lucide-react'

const navigationItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/donation', label: '기부하기', icon: Heart },
  { href: '/my', label: '마이페이지', icon: User },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/20 bg-white/80 shadow-soft backdrop-blur-xl sm:hidden">
      <div className="flex items-center justify-around px-4 py-2">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press-link ${
                isActive
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
