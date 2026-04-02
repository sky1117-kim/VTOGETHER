'use client'

import { useMemo, useState, useEffect } from 'react'
import type { UserEventSubmissionRow } from '@/api/queries/user'

const INITIAL_SHOW = 5
const STATUS_LABEL: Record<string, string> = {
  PENDING: '심사 중',
  APPROVED: '승인',
  REJECTED: '반려',
}

interface EventParticipationSectionProps {
  submissions: UserEventSubmissionRow[]
}

/** 마이페이지: 이벤트 인증 참여 내역 (반려 시 사유 표시) */
export function EventParticipationSection({ submissions }: EventParticipationSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const hashHighlightId = useMemo(() => {
    if (typeof window === 'undefined') return null
    const raw = window.location.hash.replace(/^#/, '')
    if (!raw.startsWith('event-submission-')) return null
    const sid = raw.replace(/^event-submission-/, '')
    return submissions.some((s) => s.submission_id === sid) ? raw : null
  }, [submissions])
  const shouldShowAll = showAll || !!hashHighlightId
  const displayed = shouldShowAll ? submissions : submissions.slice(0, INITIAL_SHOW)
  const hasMore = submissions.length > INITIAL_SHOW

  useEffect(() => {
    if (!hashHighlightId || typeof window === 'undefined') return
    requestAnimationFrame(() => {
      const el = document.getElementById(hashHighlightId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [hashHighlightId, shouldShowAll])

  if (submissions.length === 0) {
    return (
      <div
        id="event-submissions"
        className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-28px_rgba(2,6,23,0.55)]"
      >
        <h2 className="mb-3 inline-flex items-center gap-2 text-xl font-black text-slate-900">
          <span className="rounded-full bg-[#00b859]/15 px-2 py-0.5 text-xs font-bold text-[#00b859]">EVENT</span>
          이벤트 인증 제출 내역
        </h2>
        <p className="text-sm text-slate-500">아직 참여한 이벤트 인증이 없습니다.</p>
      </div>
    )
  }

  return (
    <div
      id="event-submissions"
      className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-28px_rgba(2,6,23,0.55)]"
    >
      <h2 className="mb-3 inline-flex items-center gap-2 text-xl font-black text-slate-900">
        <span className="rounded-full bg-[#00b859]/15 px-2 py-0.5 text-xs font-bold text-[#00b859]">EVENT</span>
        이벤트 인증 제출 내역
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        인증 제출 상태와 반려 사유를 확인할 수 있습니다.
      </p>
      <ul className="max-h-[320px] space-y-3 overflow-y-auto md:max-h-[400px]">
        {displayed.map((s) => {
          const rowId = `event-submission-${s.submission_id}`
          const isHashHighlight = hashHighlightId === rowId
          return (
          <li
            key={s.submission_id}
            id={rowId}
            className={`scroll-mt-24 rounded-xl border bg-white p-4 ${
              isHashHighlight ? 'border-[#00b859]/40 bg-[#00b859]/10' : 'border-slate-100'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-slate-900">{s.event_title}</span>
                {s.round_number != null && (
                  <span className="ml-2 text-sm text-slate-500">
                    {s.round_number}구간
                  </span>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  s.status === 'REJECTED'
                    ? 'bg-red-50 text-red-600'
                    : s.status === 'APPROVED'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                {STATUS_LABEL[s.status] ?? s.status}
              </span>
            </div>
            {s.status === 'REJECTED' && s.rejection_reason && (
              <p className="mt-2 text-sm text-red-600">
                반려 사유: {s.rejection_reason}
              </p>
            )}
            {s.status === 'REJECTED' && s.submission_preview && (
              <p className="mt-1 text-sm text-slate-600">
                내가 제출한 내용: {s.submission_preview}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              제출일 {new Date(s.created_at).toLocaleDateString('ko-KR')}
            </p>
          </li>
          )
        })}
      </ul>
      {hasMore && !shouldShowAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          더보기 ({submissions.length - INITIAL_SHOW}건)
        </button>
      )}
    </div>
  )
}
