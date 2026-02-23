'use client'

import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import DOMPurify from 'isomorphic-dompurify'

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
    hasPendingReward?: boolean
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
  if (!isOpen) return null

  const raw = event?.description?.trim() || '참여하고 포인트를 획득하세요.'
  const isHtml = /<[a-z][\s\S]*>/i.test(raw)
  const description = raw

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      {/* 배경 딤: 뒤 콘텐츠와 겹치지 않도록 전체 덮기 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 flex max-h-[90vh] min-h-[360px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-modal sm:min-h-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        {/* 헤더: 대표 이미지(있을 때) + 제목·카테고리·닫기 */}
        <div className="shrink-0 border-b border-gray-100 bg-gradient-to-br from-green-50 to-white pb-5">
          {event?.image_url?.trim() && (
            <div className="mb-4 overflow-hidden rounded-xl bg-gray-100">
              <img
                src={event.image_url}
                alt=""
                className="h-40 w-full object-cover"
              />
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                {event?.category === 'CULTURE' ? 'Culture' : 'V.Together'}
              </span>
              <h3 className="mt-2 text-xl font-bold text-gray-900">{event?.title ?? '—'}</h3>
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

        {/* 긴 내용: 상세 안내 (스크롤 가능, 하단 여백으로 구간 안내와 겹침 방지) */}
        <div className="min-h-0 flex-1 overflow-y-auto py-4 pb-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            이벤트 상세 안내
          </p>
          <div className="event-description rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm leading-relaxed text-gray-700 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_li]:list-disc [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-green-600 [&_a]:underline [&_strong]:font-bold">
            {isHtml ? (
              <div className="[&_p]:block [&_br]:block" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description, { ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'span'] }) }} />
            ) : (
              <ReactMarkdown>{description}</ReactMarkdown>
            )}
          </div>
        </div>

        {event?.type === 'SEASONAL' && event.rounds && event.rounds.length > 0 && (
          <div className="shrink-0 border-t border-gray-100 bg-white py-4">
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
          </div>
        )}

        {isLoggedIn && event && (
          <div className="shrink-0 space-y-2 border-t border-gray-100 bg-white py-4">
            {event.hasPendingReward && (
              <button
                type="button"
                onClick={() => onVerify(event.event_id)}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-white transition hover:bg-amber-600"
              >
                보상받기
              </button>
            )}
            {((event.type === 'SEASONAL' && event.rounds?.some((r) => r.status === 'OPEN')) ||
              (event.type === 'ALWAYS' && !event.hasPendingReward)) && (
              <button
                type="button"
                onClick={() => onVerify(event.event_id)}
                className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition hover:bg-green-700"
              >
                인증하기
              </button>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
