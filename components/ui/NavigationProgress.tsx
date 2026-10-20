'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * 페이지 이동 진행 막대.
 * 내부 링크 클릭 시 상단에 막대를 띄우고, 주소(pathname/search)가 바뀌면 완료 처리합니다.
 * 서버 렌더링이 오래 걸리는 화면에서 "클릭이 안 된 것 같은" 느낌을 없애기 위함.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')

  useEffect(() => {
    // 주소가 바뀌면 이동 완료
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => (prev === 'loading' ? 'done' : prev))
  }, [pathname, searchParams])

  useEffect(() => {
    if (state !== 'done') return
    const t = window.setTimeout(() => setState('idle'), 300)
    return () => window.clearTimeout(t)
  }, [state])

  useEffect(() => {
    // 안전장치: 이동이 취소되거나 같은 주소로 이동해도 막대가 계속 남지 않게
    if (state !== 'loading') return
    const t = window.setTimeout(() => setState('done'), 10000)
    return () => window.clearTimeout(t)
  }, [state])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest('a')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      setState('loading')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  if (state === 'idle') return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[10001] h-[3px]" aria-hidden>
      <div
        className={`h-full bg-gradient-to-r from-emerald-400 to-green-600 shadow-[0_0_8px_rgba(16,185,129,0.6)] ${
          state === 'loading' ? 'nav-progress' : 'w-full opacity-0 transition-opacity duration-300'
        }`}
      />
    </div>
  )
}
