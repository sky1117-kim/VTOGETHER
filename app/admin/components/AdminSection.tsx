'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface AdminSectionProps {
  title: string
  description?: string
  /** 기본 펼침 여부 */
  defaultOpen?: boolean
  children: React.ReactNode
  /** 접기 가능 여부 (false면 항상 펼침) */
  collapsible?: boolean
  /** 스크롤 앵커용 id */
  id?: string
}

/** 관리자 페이지용 접기/펼치기 가능한 섹션 */
export function AdminSection({
  title,
  description,
  defaultOpen = true,
  children,
  collapsible = true,
  id,
}: AdminSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  // URL 해시로 스크롤 시 해당 섹션 자동 펼침 (예: #admin-settings)
  useEffect(() => {
    if (!id || typeof window === 'undefined') return
    const check = () => {
      if (window.location.hash === `#${id}`) setOpen(true)
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [id])

  if (!collapsible) {
    return (
      <section id={id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-gray-900">{title}</h2>
        {description && <p className="mb-4 text-sm text-gray-500">{description}</p>}
        {children}
      </section>
    )
  }

  return (
    <section id={id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-gray-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-inset"
      >
        <div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
        </div>
        <span className="shrink-0 text-gray-400" aria-hidden>
          {open ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </span>
      </button>
      {open && <div className="border-t border-gray-100 px-6 py-5">{children}</div>}
    </section>
  )
}
