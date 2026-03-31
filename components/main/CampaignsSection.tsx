'use client'
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EventVerifyModal } from './EventVerifyModal'
import { EventInfoModal } from './EventInfoModal'
import { ALREADY_SUBMITTED_TAG_LABEL, FREQUENCY_TAG_LABEL } from '@/constants/events'
import { HealthChallengeVerifyModal } from './HealthChallengeVerifyModal'
import type { HealthSeasonPublic, HealthSubmittedTrackInfo, HealthTrackPublic } from '@/api/queries/health-challenges'

type Tab = 'ALL' | 'V.Together' | 'People'

/** DB에서 내려오는 이벤트 (getEventsWithRoundsForPublic) */
export type PublicEvent = {
  event_id: string
  title: string
  description: string | null
  category: 'CULTURE' | 'PEOPLE'
  type: string
  image_url?: string | null
  rounds_count?: number
  rounds?: { round_id: string; round_number: number; status: string }[]
  [key: string]: unknown
}

const CATEGORY_DISPLAY: Record<string, Tab> = {
  CULTURE: 'V.Together',
  PEOPLE: 'People',
  V_TOGETHER: 'V.Together', // 레거시: 마이그레이션 032 전 데이터
}

const CATEGORY_ICON: Record<string, string> = {
  CULTURE: '🚶',
  V_TOGETHER: '🚶',
  PEOPLE: '💬',
}

const FADE_DURATION_MS = 220

function toPlainTextSummary(raw: unknown): string {
  const s = String(raw ?? '')
  // 카드 요약은 HTML 없이 텍스트만 노출
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface CampaignsSectionProps {
  events: PublicEvent[]
  /** 로그인 여부 (true면 '추후 적용 예정' 문구 숨김, 인증하기 버튼 활성) */
  isLoggedIn?: boolean
  /** 활성 건강 챌린지(현재 진행 중인 시즌/종목). People 이벤트 인증하기에서 사용 */
  healthChallenge?: {
    season: HealthSeasonPublic
    tracks: HealthTrackPublic[]
    submittedTrackIds: string[]
    submittedTrackInfos: HealthSubmittedTrackInfo[]
  }
}

function normalizeAlwaysParticipation(raw: unknown): { allowed: boolean; reason?: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as { allowed?: unknown; reason?: unknown }
  if (typeof candidate.allowed !== 'boolean') return null
  return {
    allowed: candidate.allowed,
    reason: typeof candidate.reason === 'string' ? candidate.reason : undefined,
  }
}

export function CampaignsSection({ events: rawEvents, isLoggedIn = false, healthChallenge }: CampaignsSectionProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<Tab>('ALL')
  const [displayFilter, setDisplayFilter] = useState<Tab>('ALL')
  const [isFadingOut, setIsFadingOut] = useState(false)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 탭 전환 시 최신 데이터 로드 (관리자 승인 상태 반영)
  useEffect(() => {
    const onVisible = () => router.refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [router])

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

  const [verifyModalEventId, setVerifyModalEventId] = useState<string | null>(null)
  const [infoModalEvent, setInfoModalEvent] = useState<(typeof rawEvents)[0] | null>(null)
  const [healthVerifyOpen, setHealthVerifyOpen] = useState(false)
  const [healthVerifyNonce, setHealthVerifyNonce] = useState(0)

  const linkedHealthEventId = healthChallenge?.season.event_id ?? null
  const isHealthLinkedEvent = useCallback(
    (eventId: string) => {
      // 1) 정석: health_challenge_seasons.event_id로 1:1 매칭
      if (linkedHealthEventId) return eventId === linkedHealthEventId
      // 2) 안전장치: event_id가 비어있으면 People 카테고리를 건강 챌린지로 간주
      const raw = rawEvents.find((e) => e.event_id === eventId)
      return raw?.category === 'PEOPLE'
    },
    [linkedHealthEventId, rawEvents],
  )

  const events = rawEvents.map((e) => ({
    id: e.event_id,
    category: CATEGORY_DISPLAY[e.category] ?? 'V.Together',
    title: e.title,
    desc: toPlainTextSummary(e.short_description ?? e.description) || '참여하고 포인트를 획득하세요.',
    icon: CATEGORY_ICON[e.category] ?? '🎯',
    image_url: e.image_url ?? null,
    type: e.type as string,
    rounds_count: e.rounds_count ?? 0,
    rounds: e.rounds ?? [],
    frequency_limit: (e as { frequency_limit?: string | null }).frequency_limit ?? null,
    alwaysParticipation: normalizeAlwaysParticipation((e as { alwaysParticipation?: unknown }).alwaysParticipation),
  }))

  const filtered =
    displayFilter === 'ALL'
      ? events
      : events.filter((c) => c.category === displayFilter)

  const ROUND_STATUS_LABEL: Record<string, string> = {
    OPEN: '인증가능',
    LOCKED: '미오픈',
    SUBMITTED: '승인 대기중',
    APPROVED: '승인완료',
    DONE: '완료',
    FAILED: '마감',
    REJECTED: '반려됨',
  }

  return (
    <section id="events" className="mb-16">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="section-title flex items-center gap-3 text-gray-900">
            <span className="h-8 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
            이벤트 & 챌린지
          </h2>
          <p className="mt-1 text-gray-500">참여하고 포인트를 획득하세요.</p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-xl bg-white/60 p-1.5 shadow-soft backdrop-blur-sm">
          {(['ALL', 'V.Together', 'People'] as const).map((tab) => (
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
        {filtered.length === 0 ? (
          <p className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center text-sm text-gray-500">
            진행 중인 이벤트가 없습니다.
          </p>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => setInfoModalEvent(rawEvents.find((e) => e.event_id === c.id) ?? null)}
              onKeyDown={(e) => e.key === 'Enter' && setInfoModalEvent(rawEvents.find((e) => e.event_id === c.id) ?? null)}
              className="card-hover glass flex cursor-pointer flex-col rounded-2xl p-5 shadow-soft"
            >
              <div className="mb-4">
                {c.image_url?.trim() ? (
                  <div className="mb-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                    <img
                      src={c.image_url}
                      alt=""
                      className="h-24 w-full object-cover object-center"
                    />
                  </div>
                ) : (
                  <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-2xl">
                    {c.icon}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold leading-tight">{c.title}</h3>
                    <span
                      className={`shrink-0 rounded px-1.5 text-[10px] font-bold ${
                        c.category === 'People'
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
                  {c.type === 'SEASONAL' && c.rounds && c.rounds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.rounds.map((r) => (
                        <span
                          key={r.round_id}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            r.status === 'OPEN'
                              ? 'bg-green-100 text-green-700'
                              : r.status === 'REJECTED'
                                ? 'bg-red-50 text-red-600'
                                : r.status === 'SUBMITTED'
                                  ? 'bg-amber-100 text-amber-700'
                                  : r.status === 'FAILED'
                                    ? 'bg-gray-100 text-gray-500'
                                    : r.status === 'DONE'
                                      ? 'bg-gray-100 text-gray-600'
                                      : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {r.round_number}구간 {ROUND_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.type === 'ALWAYS' && c.frequency_limit && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {FREQUENCY_TAG_LABEL[c.frequency_limit] ?? `${c.frequency_limit} 가능`}
                      </span>
                      {c.alwaysParticipation?.allowed === false && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                          {ALREADY_SUBMITTED_TAG_LABEL[c.frequency_limit] ?? '이미 제출함'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* 카드 하단: 상세 보기 + 액션 버튼 — mt-auto로 카드마다 하단 정렬 통일 */}
              <div className="mt-auto flex min-h-[2.5rem] items-center justify-between gap-3 pt-4">
                <span className="shrink-0 text-xs text-gray-400">클릭 시 상세 보기</span>
                {isLoggedIn ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {/* 인증하기: 기간제 OPEN 구간 또는 상시 이벤트 */}
                    {((c.type === 'SEASONAL' && c.rounds?.some((r) => r.status === 'OPEN')) ||
                      c.type === 'ALWAYS') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (healthChallenge && isHealthLinkedEvent(c.id)) {
                            setVerifyModalEventId(null)
                            setHealthVerifyNonce((v) => v + 1)
                            setHealthVerifyOpen(true)
                            return
                          }
                          setHealthVerifyOpen(false)
                          setVerifyModalEventId(c.id)
                        }}
                        className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-green-700 btn-press"
                      >
                        인증하기
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="shrink-0 text-xs text-gray-400">로그인 후 인증 가능</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <EventInfoModal
        event={infoModalEvent ? {
          event_id: infoModalEvent.event_id,
          title: infoModalEvent.title,
          description: infoModalEvent.description ?? null,
          image_url: infoModalEvent.image_url ?? null,
          category: infoModalEvent.category,
          type: infoModalEvent.type,
          rounds: infoModalEvent.rounds,
          frequency_limit: (infoModalEvent as { frequency_limit?: string | null }).frequency_limit ?? null,
          alwaysParticipation: normalizeAlwaysParticipation((infoModalEvent as { alwaysParticipation?: unknown }).alwaysParticipation) ?? undefined,
        } : null}
        isOpen={!!infoModalEvent}
        onClose={() => setInfoModalEvent(null)}
        onVerify={(eventId) => {
          setInfoModalEvent(null)
          if (healthChallenge && isHealthLinkedEvent(eventId)) {
            setVerifyModalEventId(null)
            setHealthVerifyNonce((v) => v + 1)
            setHealthVerifyOpen(true)
            return
          }
          setHealthVerifyOpen(false)
          setVerifyModalEventId(eventId)
        }}
        isLoggedIn={isLoggedIn}
      />
      <EventVerifyModal
        eventId={verifyModalEventId}
        isOpen={!!verifyModalEventId}
        onClose={() => setVerifyModalEventId(null)}
        onSuccess={() => {
          setVerifyModalEventId(null)
          router.refresh()
        }}
      />
      {healthChallenge && (
        <HealthChallengeVerifyModal
          key={healthVerifyNonce}
          isOpen={healthVerifyOpen}
          onClose={() => setHealthVerifyOpen(false)}
          isLoggedIn={isLoggedIn}
          season={healthChallenge.season}
          tracks={healthChallenge.tracks}
          submittedTrackIds={healthChallenge.submittedTrackIds}
          submittedTrackInfos={healthChallenge.submittedTrackInfos}
          onSuccess={() => {
            // 모달 내부에서 close + refresh도 수행하지만, 카드 상태 반영을 위해 한 번 더 갱신
            router.refresh()
          }}
        />
      )}
    </section>
  )
}
