'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

type Level = 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'

interface LevelRoadmapModalProps {
  level: Level
  totalDonated?: number
  children: ReactNode
}

const levelThresholds: Record<Level, { min: number; max: number; next: number | null; label: string; icon: string }> = {
  ECO_KEEPER: { min: 0, max: 30000, next: 30001, label: 'Eco Keeper', icon: '🌱' },
  GREEN_MASTER: { min: 30001, max: 80000, next: 80001, label: 'Green Master', icon: '🌿' },
  EARTH_HERO: { min: 80001, max: Infinity, next: null, label: 'Earth Hero', icon: '🌳' },
}

const levelOrder: Level[] = ['ECO_KEEPER', 'GREEN_MASTER', 'EARTH_HERO']

export function LevelRoadmapModal({ level, totalDonated = 0, children }: LevelRoadmapModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const current = levelThresholds[level]
  const nextLevel = level === 'ECO_KEEPER' ? 'GREEN_MASTER' : level === 'GREEN_MASTER' ? 'EARTH_HERO' : null
  const prevMax = level === 'ECO_KEEPER' ? 0 : level === 'GREEN_MASTER' ? 30000 : 80000
  const range = nextLevel ? (levelThresholds[nextLevel].min - prevMax) : 0
  const progressInRange = nextLevel ? Math.min(Math.max((totalDonated - prevMax) / range, 0), 1) : 1
  const progressPercent = Math.round(progressInRange * 100)

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="my-auto w-full max-w-sm shrink-0 overflow-hidden rounded-[32px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 그라데이션 */}
            <div className="relative overflow-hidden bg-gradient-to-br from-green-500 to-green-700 p-8 text-white">
              <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
              <p className="relative z-10 mb-2 text-center text-sm font-bold text-green-100">
                MY ESG LEVEL
              </p>
              <div className="relative z-10 mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/30 bg-white/20 backdrop-blur-sm">
                <span className="text-5xl">{current.icon}</span>
              </div>
              <h2 className="relative z-10 text-center text-2xl font-bold">{current.label}</h2>
              <p className="relative z-10 text-center text-xs text-green-100">
                누적 기부: <span className="font-bold text-white">{totalDonated.toLocaleString()}</span> P
              </p>
            </div>

            {/* 게이지 + 진행도 */}
            <div className="px-6 py-6">
              <div className="mb-4">
                <div className="mb-2 flex justify-between text-xs font-bold text-gray-500">
                  <span>다음 레벨 진행도</span>
                  <span className="text-green-600">{progressPercent}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="level-progress-fill h-full rounded-full transition-all duration-700"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-sm font-medium text-gray-600">
                  {nextLevel ? (
                    <>
                      <span className="font-bold text-green-600">{levelThresholds[nextLevel].label}</span>
                      {' '}까지 {(levelThresholds[nextLevel].min - totalDonated).toLocaleString()}P 남음
                    </>
                  ) : (
                    <span className="font-bold text-green-600">최고 레벨 달성!</span>
                  )}
                </p>
              </div>

              {/* 레벨 목록 */}
              <div className="space-y-2">
                {levelOrder.map((key) => {
                  const t = levelThresholds[key]
                  const isCurrent = key === level
                  const isPast = levelOrder.indexOf(level) > levelOrder.indexOf(key)
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 rounded-xl p-3 ${
                        isCurrent
                          ? 'border-2 border-green-200 bg-green-50'
                          : isPast
                            ? 'bg-gray-50 opacity-75'
                            : 'bg-gray-50'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
                          isCurrent ? 'bg-green-100 text-green-600' : 'bg-white text-gray-400'
                        }`}
                      >
                        {t.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800">{t.label}</p>
                        <p className="text-xs text-gray-500">
                          {t.min.toLocaleString()} ~ {t.max === Infinity ? '∞' : t.max.toLocaleString()} P
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                          현재
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
