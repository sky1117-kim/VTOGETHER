'use client'

import { useState, useRef, useCallback } from 'react'

type Tab = 'ALL' | 'V.Together' | 'Culture'

const campaigns = [
  {
    id: 'c1',
    category: 'V.Together' as const,
    title: '1월 걷기 챌린지',
    desc: '건강과 환경을 위한 한 걸음! 매일 6,000보를 걷고 인증해주세요.',
    icon: '🚶',
    color: 'green',
  },
  {
    id: 'c2',
    category: 'V.Together' as const,
    title: '텀블러 사용 인증',
    desc: '사내 카페나 개인 컵 사용 인증샷을 올려주세요.',
    icon: '☕',
    color: 'blue',
  },
  {
    id: 'c3',
    category: 'Culture' as const,
    title: '칭찬 릴레이',
    desc: '고마운 동료에게 따뜻한 마음을 전하세요.',
    icon: '💬',
    color: 'purple',
  },
]

const FADE_DURATION_MS = 220

export function CampaignsSection() {
  const [filter, setFilter] = useState<Tab>('ALL')
  const [displayFilter, setDisplayFilter] = useState<Tab>('ALL')
  const [isFadingOut, setIsFadingOut] = useState(false)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFilterChange = useCallback((tab: Tab) => {
    if (tab === filter) return
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    setFilter(tab)
    setIsFadingOut(true)
    fadeTimeoutRef.current = setTimeout(() => {
      setDisplayFilter(tab)
      setIsFadingOut(false)
      fadeTimeoutRef.current = null
    }, FADE_DURATION_MS)
  }, [filter])

  const filtered =
    displayFilter === 'ALL'
      ? campaigns
      : campaigns.filter((c) => c.category === displayFilter)

  return (
    <section id="campaigns" className="mb-16">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="section-title flex items-center gap-3 text-gray-900">
            <span className="h-8 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
            이벤트 & 챌린지
          </h2>
          <p className="mt-1 text-gray-500">참여하고 포인트를 획득하세요.</p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-xl bg-white/60 p-1.5 shadow-soft backdrop-blur-sm">
          {(['ALL', 'V.Together', 'Culture'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleFilterChange(tab)}
              className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-200 ${
                filter === tab
                  ? 'bg-white text-green-700 shadow-soft'
                  : 'text-gray-600 hover:bg-white/70 hover:text-gray-800'
              }`}
            >
              {tab === 'ALL' ? '전체' : tab}
            </button>
          ))}
        </div>
      </div>
      <div
        className="grid grid-cols-1 gap-6 md:grid-cols-3 transition-opacity duration-[220ms] ease-out"
        style={{ opacity: isFadingOut ? 0 : 1 }}
      >
        {filtered.map((c) => (
          <div
            key={c.id}
            className="card-hover glass flex flex-col rounded-2xl p-5 shadow-soft"
          >
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                {c.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold leading-tight">{c.title}</h3>
                  <span
                    className={`rounded px-1.5 text-[10px] font-bold ${
                      c.category === 'Culture'
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-green-100 text-green-600'
                    }`}
                  >
                    {c.category}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                  {c.desc}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-gray-100/60 p-3 shadow-soft">
              <p className="mb-2 text-xs text-gray-500">
                (로그인 기능은 추후 적용 예정)
              </p>
              <span className="flex w-full cursor-default items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 text-sm font-bold text-gray-400">
                인증하기
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
