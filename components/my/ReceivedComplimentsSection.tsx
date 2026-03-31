'use client'

import { useState } from 'react'
import type { ReceivedComplimentRow } from '@/api/queries/user'

const INITIAL_SHOW = 5

interface ReceivedComplimentsSectionProps {
  compliments: ReceivedComplimentRow[]
}

/** 마이페이지: 나에게 보낸 칭찬 내용 목록 (칭찬 챌린지 수신) */
export function ReceivedComplimentsSection({ compliments }: ReceivedComplimentsSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? compliments : compliments.slice(0, INITIAL_SHOW)
  const hasMore = compliments.length > INITIAL_SHOW

  if (compliments.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-28px_rgba(2,6,23,0.55)]">
        <h2 className="mb-3 inline-flex items-center gap-2 text-xl font-black text-slate-900">
          <span className="rounded-full bg-[#00b859]/15 px-2 py-0.5 text-xs font-bold text-[#00b859]">PRAISE</span>
          받은 칭찬
        </h2>
        <p className="text-sm text-slate-500">아직 받은 칭찬이 없습니다.</p>
      </div>
    )
  }

  return (
    <div id="received-compliments" className="scroll-mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-28px_rgba(2,6,23,0.55)]">
      <h2 className="mb-3 inline-flex items-center gap-2 text-xl font-black text-slate-900">
        <span className="rounded-full bg-[#00b859]/15 px-2 py-0.5 text-xs font-bold text-[#00b859]">PRAISE</span>
        받은 칭찬
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        칭찬 챌린지로 동료가 보내준 칭찬 내용을 확인할 수 있습니다. (포인트 내역의 &apos;내가 칭찬 받은 내역&apos;과 연결됩니다)
      </p>
      <ul className="max-h-[320px] space-y-3 overflow-y-auto md:max-h-[400px]">
        {displayed.map((c) => (
          <li
            key={c.submission_id}
            className="rounded-xl border border-slate-100 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-[#00b859]/15 px-2.5 py-0.5 text-xs font-semibold text-[#00b859]">
                {c.event_title}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(c.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {/* 발신자: 보조 정보로 차분하게 (작은 회색) */}
            <p className="mt-2 text-xs text-slate-500">
              {c.is_anonymous ? '익명' : c.sender_name ? `${c.sender_name}님이 보냈습니다` : '보낸 사람 정보 없음'}
            </p>
            {/* 칭찬 내용: 메인으로만 강조 (인용구 스타일) */}
            {c.message ? (
              <p className="mt-2 whitespace-pre-wrap text-base font-semibold leading-relaxed text-slate-900">
                &ldquo;{c.message}&rdquo;
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-slate-500">칭찬 메시지 없음</p>
            )}
          </li>
        ))}
      </ul>
      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          더보기 ({compliments.length - INITIAL_SHOW}건)
        </button>
      )}
    </div>
  )
}
