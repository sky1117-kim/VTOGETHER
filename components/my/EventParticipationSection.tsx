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

/** 마이페이지: 이벤트 인증 참여 내역. 반려 시 사유를 상단에 강조 */
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

  const sectionShell = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_-24px_rgba(2,6,23,0.45)] sm:p-6'

  if (submissions.length === 0) {
    return (
      <div id="event-submissions" className={`scroll-mt-24 ${sectionShell}`}>
        <h2 className="inline-flex flex-wrap items-center gap-2 text-lg font-black tracking-tight text-slate-900 sm:text-xl">
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:text-xs">
            Event
          </span>
          이벤트 인증 제출 내역
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-600">제출 상태와 반려 사유를 여기서 확인할 수 있어요.</p>
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
          아직 참여한 이벤트 인증이 없습니다.
        </p>
      </div>
    )
  }

  return (
    <div id="event-submissions" className={`scroll-mt-24 ${sectionShell}`}>
      <h2 className="inline-flex flex-wrap items-center gap-2 text-lg font-black tracking-tight text-slate-900 sm:text-xl">
        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:text-xs">
          Event
        </span>
        이벤트 인증 제출 내역
      </h2>
      <p className="mt-2 text-sm font-medium text-slate-600">
        승인·심사 중·반려 상태를 확인하세요. <span className="text-red-600">반려된 건은 붉은 상자에 사유</span>가 먼저 나옵니다.
      </p>

      <ul className="mt-5 max-h-[min(60vh,480px)] space-y-4 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
        {displayed.map((s) => {
          const rowId = `event-submission-${s.submission_id}`
          const isHashHighlight = hashHighlightId === rowId
          const isRejected = s.status === 'REJECTED'

          return (
            <li
              key={s.submission_id}
              id={rowId}
              className={`rounded-2xl border transition-colors ${
                isHashHighlight
                  ? 'border-[#00b859]/50 bg-emerald-50/40 ring-2 ring-[#00b859]/20'
                  : isRejected
                    ? 'border-red-200/90 bg-red-50/20'
                    : 'border-slate-200/90 bg-slate-50/30'
              }`}
            >
              <div className="p-4 sm:p-5">
                {/* 제목 행: 이벤트명 + 상태 + 제출일 */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold leading-snug text-slate-900 sm:text-[17px]">{s.event_title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                      {s.round_number != null && <span>{s.round_number}구간</span>}
                      <span className="text-slate-400 sm:before:mr-2 sm:before:inline-block sm:before:h-1 sm:before:w-1 sm:before:rounded-full sm:before:bg-slate-300 sm:before:align-middle sm:before:content-['']">
                        제출{' '}
                        {new Date(s.created_at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-bold ${
                      isRejected
                        ? 'bg-red-600 text-white'
                        : s.status === 'APPROVED'
                          ? 'bg-green-600 text-white'
                          : 'bg-amber-500 text-white'
                    }`}
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>

                {/* 반려: 카드 상단에 즉시 눈에 띄게 */}
                {isRejected && s.rejection_reason && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-700">반려 사유</p>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-red-900">{s.rejection_reason}</p>
                  </div>
                )}

                {isRejected && s.submission_preview && (
                  <div className="mt-3 rounded-xl bg-white/70 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200/80">
                    <span className="text-xs font-semibold text-slate-500">내가 제출한 요약 </span>
                    <span className="mt-0.5 block whitespace-pre-wrap">{s.submission_preview}</span>
                  </div>
                )}

                {/* 동료 선택: 단일 박스로 정리 (카드 안 카드 느낌 최소화) */}
                {s.peer_target_display && (
                  <div className="mt-4 space-y-2 rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200/80">
                    <p className="text-xs font-bold text-slate-500">{s.peer_target_display.fieldLabel}</p>
                    {s.peer_target_display.teamLabel ? (
                      <p className="text-sm text-slate-800">
                        팀(부서){' '}
                        <span className="font-semibold text-[#00b859]">{s.peer_target_display.teamLabel}</span>
                      </p>
                    ) : null}
                    <p className="text-xs font-medium text-slate-500">
                      포함 인원 {s.peer_target_display.memberLines.length}명
                    </p>
                    <ul className="space-y-1.5 text-sm font-medium leading-snug text-slate-800">
                      {s.peer_target_display.memberLines.map((line, idx) => (
                        <li key={idx} className="flex gap-2 break-words">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b859]" aria-hidden />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {hasMore && !shouldShowAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
        >
          제출 내역 더 보기 ({submissions.length - INITIAL_SHOW}건)
        </button>
      )}
    </div>
  )
}
