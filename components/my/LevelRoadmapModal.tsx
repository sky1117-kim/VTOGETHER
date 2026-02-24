'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'

type Level = 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'

interface LevelRoadmapModalProps {
  level: Level
  totalDonated?: number
  children: ReactNode
}

const levelThresholds: Record<Level, { min: number; max: number; next: number | null; label: string; icon: string }> = {
  ECO_KEEPER: { min: 10000, max: 50000, next: 50001, label: 'Eco Keeper', icon: '🌱' },   // 새싹
  GREEN_MASTER: { min: 50001, max: 100000, next: 100001, label: 'Green Master', icon: '🌳' }, // 나무
  EARTH_HERO: { min: 100001, max: Infinity, next: null, label: 'Earth Hero', icon: '🌍' },  // 지구
}

// 제일 어려운 레벨부터 낮은 레벨까지 순서 (역순)
const levelOrder: Level[] = ['EARTH_HERO', 'GREEN_MASTER', 'ECO_KEEPER']

/** 등급별 색상 (게이지, 배지, 체크 등) */
const LEVEL_COLORS: Record<Level, { progress: string; text: string; bg: string; border: string; badge: string; iconBg: string; iconText: string }> = {
  ECO_KEEPER: {
    progress: 'level-progress-fill-eco',
    text: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    badge: 'bg-slate-600',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
  },
  GREEN_MASTER: {
    progress: 'level-progress-fill',
    text: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-600',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
  },
  EARTH_HERO: {
    progress: 'level-progress-fill-hero',
    text: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    badge: 'bg-violet-600',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
  },
}

export function LevelRoadmapModal({ level, totalDonated = 0, children }: LevelRoadmapModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useBodyScrollLock(isOpen)
  const current = levelThresholds[level]
  const nextLevel = level === 'ECO_KEEPER' ? 'GREEN_MASTER' : level === 'GREEN_MASTER' ? 'EARTH_HERO' : null
  const prevMax = level === 'ECO_KEEPER' ? 10000 : level === 'GREEN_MASTER' ? 50001 : 100001
  const range = nextLevel ? (levelThresholds[nextLevel].min - current.min) : 0
  const progressInRange = nextLevel ? Math.min(Math.max((totalDonated - current.min) / range, 0), 1) : 1
  const progressPercent = Math.round(progressInRange * 100)

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/50 p-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="my-auto max-h-[90vh] w-full max-w-sm shrink-0 overflow-y-auto rounded-[32px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단: 등급별 그라데이션 (Eco Keeper=회색/남색, Green Master=초록, Earth Hero=보라) */}
            <div
              className={`relative overflow-hidden p-8 text-white ${
                level === 'GREEN_MASTER'
                  ? 'bg-gradient-to-br from-emerald-500 via-green-600 to-teal-800'
                  : level === 'EARTH_HERO'
                    ? 'bg-gradient-to-br from-violet-600 to-purple-800'
                    : 'bg-gradient-to-br from-slate-500 via-slate-600 to-indigo-700'
              }`}
            >
              {/* 정적 반짝임 하이라이트 (Green Master 시 더 강조) */}
              <div
                className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.5\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"
                aria-hidden
              />
              {level === 'GREEN_MASTER' && (
                <div
                  className="absolute inset-0 opacity-50"
                  aria-hidden
                  style={{
                    background: 'linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.08) 55%, transparent 75%)',
                  }}
                />
              )}
              <p className={`relative z-10 mb-2 text-center text-sm font-bold ${level === 'ECO_KEEPER' ? 'text-slate-200' : 'text-green-100'}`}>
                MY ESG LEVEL
              </p>
              <div className="relative z-10 mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/30 bg-white/20 backdrop-blur-sm">
                <span className="text-5xl">{current.icon}</span>
              </div>
              <h2 className="relative z-10 text-center text-2xl font-bold">{current.label}</h2>
              <p className={`relative z-10 text-center text-base font-bold sm:text-lg ${level === 'ECO_KEEPER' ? 'text-slate-200' : 'text-green-100'}`}>
                누적 기부: <span className="text-xl font-bold text-white sm:text-2xl">{totalDonated.toLocaleString()}</span> P
              </p>
            </div>

            {/* 게이지 + 진행도 */}
            <div className="px-6 py-6">
              <div className="mb-4">
                <div className="mb-2 flex justify-between text-xs font-bold text-gray-500">
                  <span>다음 레벨 진행도</span>
                  <span className={LEVEL_COLORS[level].text}>{progressPercent}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${LEVEL_COLORS[level].progress}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-sm font-medium text-gray-600">
                  {nextLevel ? (
                    <>
                      <span className={`font-bold ${LEVEL_COLORS[level].text}`}>
                        {levelThresholds[nextLevel].label}
                      </span>
                      {' '}까지 {(levelThresholds[nextLevel].min - totalDonated).toLocaleString()}P 남음
                    </>
                  ) : (
                    <span className={`font-bold ${LEVEL_COLORS[level].text}`}>최고 레벨 달성!</span>
                  )}
                </p>
              </div>

              {/* 레벨 목록: 각 등급별 색상 적용 */}
              <div className="space-y-2">
                {levelOrder.map((key) => {
                  const t = levelThresholds[key]
                  const isCurrent = key === level
                  const currentIndex = levelOrder.indexOf(level)
                  const keyIndex = levelOrder.indexOf(key)
                  const isPast = keyIndex > currentIndex
                  const colors = LEVEL_COLORS[key]
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 rounded-xl p-3 ${
                        isCurrent
                          ? `border-2 ${colors.border} ${colors.bg}`
                          : isPast
                            ? `border ${colors.border}/50 ${colors.bg}/50`
                            : 'bg-gray-50'
                      }`}
                    >
                      <div
                        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
                          isCurrent ? `${colors.iconBg} ${colors.iconText}` : isPast ? `${colors.iconBg} ${colors.iconText}` : 'bg-white text-gray-400'
                        }`}
                      >
                        {isPast ? '✓' : t.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${isPast ? `${colors.text}/60` : 'text-gray-800'}`}>
                          {t.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t.min.toLocaleString()} ~ {t.max === Infinity ? '∞' : t.max.toLocaleString()} P
                        </p>
                      </div>
                      {isCurrent && (
                        <span className={`shrink-0 rounded-full ${colors.badge} px-2 py-0.5 text-xs font-bold text-white`}>
                          현재
                        </span>
                      )}
                      {isPast && (
                        <span className={`shrink-0 rounded-full ${colors.badge} px-2 py-0.5 text-xs font-bold text-white`}>
                          완료
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="mt-6 w-full rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <div onClick={() => setIsOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setIsOpen(true)}>
        {children}
      </div>
      {mounted && typeof document !== 'undefined' && modalContent && createPortal(modalContent, document.body)}
    </>
  )
}
