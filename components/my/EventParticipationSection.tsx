'use client'

import { useState } from 'react'
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
  const displayed = showAll ? submissions : submissions.slice(0, INITIAL_SHOW)
  const hasMore = submissions.length > INITIAL_SHOW

  if (submissions.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-gray-900">이벤트 참여 내역</h2>
        <p className="text-sm text-gray-500">아직 참여한 이벤트 인증이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-gray-900">이벤트 참여 내역</h2>
      <p className="mb-4 text-sm text-gray-500">
        인증 제출 상태와 반려 사유를 확인할 수 있습니다.
      </p>
      <ul className="max-h-[320px] space-y-3 overflow-y-auto md:max-h-[400px]">
        {displayed.map((s) => (
          <li
            key={s.submission_id}
            className="rounded-xl border border-gray-100 bg-gray-50/50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-900">{s.event_title}</span>
                {s.round_number != null && (
                  <span className="ml-2 text-sm text-gray-500">
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
            <p className="mt-1 text-xs text-gray-400">
              제출일 {new Date(s.created_at).toLocaleDateString('ko-KR')}
            </p>
          </li>
        ))}
      </ul>
      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
        >
          더보기 ({submissions.length - INITIAL_SHOW}건)
        </button>
      )}
    </div>
  )
}
