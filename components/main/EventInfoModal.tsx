'use client'
/* eslint-disable @next/next/no-img-element */

import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import DOMPurify from 'isomorphic-dompurify'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { ALREADY_SUBMITTED_TAG_LABEL, FREQUENCY_TAG_LABEL } from '@/constants/events'

const STATUS_LABEL: Record<string, string> = {
  OPEN: '인증가능',
  LOCKED: '미오픈',
  SUBMITTED: '승인 대기중',
  APPROVED: '보상대기',
  DONE: '완료',
  FAILED: '마감',
  REJECTED: '반려됨',
}

const STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700',
  LOCKED: 'bg-gray-100 text-gray-500',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  DONE: 'bg-gray-100 text-gray-600',
  FAILED: 'bg-red-50 text-red-600',
  REJECTED: 'bg-red-50 text-red-600',
}

interface EventInfoModalProps {
  event: {
    event_id: string
    title: string
    description: string | null
    image_url?: string | null
    category: string
    type: string
    rounds?: { round_number: number; status: string }[]
    frequency_limit?: string | null
    alwaysParticipation?: { allowed: boolean; reason?: string }
  } | null
  isOpen: boolean
  onClose: () => void
  onVerify: (eventId: string) => void
  isLoggedIn: boolean
}

export function EventInfoModal({
  event,
  isOpen,
  onClose,
  onVerify,
  isLoggedIn,
}: EventInfoModalProps) {
  useBodyScrollLock(isOpen)
  const descriptionRef = useRef<HTMLDivElement>(null)

  // 커스텀 hex(data-color="#...", data-bg-color="#...") 인라인 스타일로 적용해 글자/배경 제대로 보이게
  useEffect(() => {
    const el = descriptionRef.current
    if (!el) return
    el.querySelectorAll<HTMLElement>('span[data-color^="#"]').forEach((span) => {
      const c = span.getAttribute('data-color')
      if (c) span.style.color = c
    })
    el.querySelectorAll<HTMLElement>('span[data-bg-color^="#"]').forEach((span) => {
      const c = span.getAttribute('data-bg-color')
      if (c) span.style.backgroundColor = c
    })
  }, [event?.description])

  if (!isOpen) return null

  // 상세 소개문구: RichTextEditor(TipTap)는 HTML로 저장하므로, 태그가 있으면 HTML로 렌더 (에디터와 동일하게)
  const raw = event?.description?.trim() || '참여하고 포인트를 획득하세요.'
  const isHtml = /<[a-z][^>]*>/i.test(raw)

  // TipTap 에디터에서 Enter로 만든 빈 문단(<p></p>)은 getHTML() 시 <br>이 빠져 높이가 0으로 무너짐
  // 에디터와 동일한 줄간격을 유지하기 위해 빈 문단에 <br>을 삽입
  const description = isHtml ? raw.replace(/<p><\/p>/g, '<p><br></p>') : raw

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4 sm:p-6" role="dialog" aria-modal="true">
      {/* 배경 딤: 뒤 콘텐츠와 겹치지 않도록 전체 덮기 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 flex max-h-[88vh] min-h-[320px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-modal sm:min-h-[360px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 고정 (상단) */}
        <div className="flex-shrink-0 border-b border-gray-100 bg-gradient-to-br from-green-50 to-white p-4 pb-4 sm:p-5 sm:pb-4">
          {event?.image_url?.trim() && (
            <div className="mb-3 overflow-hidden rounded-xl bg-gray-100">
              <img
                src={event.image_url}
                alt=""
                className="h-28 w-full object-cover sm:h-32"
              />
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                {event?.category === 'PEOPLE' ? 'People' : 'V.Together'}
              </span>
              <h3 className="mt-2 text-lg font-bold text-gray-900 sm:text-xl">{event?.title ?? '—'}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/80 hover:text-gray-600"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 본문만 스크롤 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            이벤트 상세 안내
          </p>
          {/* 에디터(RichTextEditor)와 동일: 패딩·줄간격·단락/목록 스페이싱·글자색/배경색(hex) 적용 */}
          <div
            ref={descriptionRef}
            className="event-description rte-content min-h-0 w-full break-keep whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm leading-relaxed text-gray-900 outline-none sm:text-[15px] [&_a]:text-green-600 [&_a]:underline [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:leading-relaxed [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:leading-relaxed"
          >
            {isHtml ? (
              <>
                <div
                  className="[&_br]:block [&_p]:block [&_span]:inline"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(description, {
                      ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'span'],
                      ALLOWED_ATTR: ['href', 'data-size', 'data-color', 'data-bg-color'],
                    }),
                  }}
                />
              </>
            ) : (
              <ReactMarkdown>{description}</ReactMarkdown>
            )}
          </div>
        </div>

        {/* 푸터 고정 (하단) */}
        {(event?.type === 'SEASONAL' && event?.rounds && event.rounds.length > 0) || (isLoggedIn && event) ? (
          <div className="flex-shrink-0 border-t border-gray-100 bg-white p-4 pt-3 sm:p-5 sm:pt-4">
            {event?.type === 'SEASONAL' && event.rounds && event.rounds.length > 0 && (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  구간 안내
                </p>
                <div className="flex flex-wrap gap-2">
                  {event.rounds.map((r) => (
                    <span
                      key={r.round_number}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        STATUS_CLASS[r.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {r.round_number}구간 {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  ))}
                </div>
              </>
            )}
            {event?.type === 'ALWAYS' && event.frequency_limit && (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  참여 빈도
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    {FREQUENCY_TAG_LABEL[event.frequency_limit] ?? `${event.frequency_limit} 가능`}
                  </span>
                  {event.alwaysParticipation?.allowed === false && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                      {ALREADY_SUBMITTED_TAG_LABEL[event.frequency_limit] ?? '이미 제출함'}
                    </span>
                  )}
                </div>
              </>
            )}
            {isLoggedIn && event && (
              <div className="mt-4 space-y-2">
                {((event.type === 'SEASONAL' && event.rounds?.some((r) => r.status === 'OPEN')) ||
                  event.type === 'ALWAYS') && (
                  <button
                    type="button"
                    onClick={() => onVerify(event.event_id)}
                    className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 btn-press"
                  >
                    인증하기
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
