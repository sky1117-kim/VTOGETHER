'use client'

import { useState } from 'react'
import type { ReceivedComplimentRow } from '@/api/queries/user'

const INITIAL_SHOW = 5

interface ReceivedComplimentsSectionProps {
  compliments: ReceivedComplimentRow[]
}

/** 마이페이지: 나에게 보낸 칭찬 내용 목록 (칭찬 챌린지 수신). 본문을 최우선으로 크게 표시 */
export function ReceivedComplimentsSection({ compliments }: ReceivedComplimentsSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? compliments : compliments.slice(0, INITIAL_SHOW)
  const hasMore = compliments.length > INITIAL_SHOW

  if (compliments.length === 0) {
    return (
      <div
        id="received-compliments"
        className="scroll-mt-24 rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white p-5 shadow-[0_12px_32px_-24px_rgba(2,6,23,0.45)] sm:p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 className="inline-flex flex-wrap items-center gap-2 text-lg font-black tracking-tight text-slate-900 sm:text-xl">
            <span className="rounded-full bg-[#00b859] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:text-xs">
              Praise
            </span>
            받은 칭찬
          </h2>
          <p className="text-sm font-medium text-slate-600">동료가 남긴 칭찬을 여기서 모아서 볼 수 있어요.</p>
        </div>
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
          아직 받은 칭찬이 없습니다.
        </p>
      </div>
    )
  }

  return (
    <div
      id="received-compliments"
      className="scroll-mt-24 rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/50 via-white to-white p-5 shadow-[0_14px_40px_-28px_rgba(2,6,23,0.5)] sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 className="inline-flex flex-wrap items-center gap-2 text-lg font-black tracking-tight text-slate-900 sm:text-xl">
          <span className="rounded-full bg-[#00b859] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:text-xs">
            Praise
          </span>
          받은 칭찬
        </h2>
        <p className="text-sm font-medium leading-snug text-slate-700">칭찬 메시지를 빠르게 확인할 수 있도록 핵심 정보부터 배치했습니다.</p>
        <details className="group text-sm text-slate-600">
          <summary className="cursor-pointer list-none font-medium text-[#00b859] underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
            포인트 내역·제출 방식 안내
          </summary>
          <p className="mt-2 rounded-lg bg-white/90 px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-100">
            동료가 칭찬 챌린지에 제출한 내용이 자동으로 표시됩니다. 본인이 별도 인증을 넣지 않아도 됩니다. 포인트 탭의
            &apos;내가 칭찬 받은 내역&apos;과 연결됩니다.
          </p>
        </details>
      </div>

      <ul className="mt-5 max-h-[min(70vh,560px)] space-y-4 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
        {displayed.map((c) => (
          <li
            key={c.submission_id}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100/80"
          >
            {/* 상단 요약: 보낸 사람/키워드를 먼저 보여주고 본문으로 이어지게 */}
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white">
                  {c.is_anonymous ? '익명' : c.sender_name ? `${c.sender_name}` : '보낸 사람 정보 없음'}
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  {c.event_title}
                </span>
                {c.organization_name && c.organization_name.trim() !== c.message.trim() && (
                  <span className="max-w-full truncate rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                    {c.organization_name}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {new Date(c.created_at).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {/* 본문: 상단 요약 아래에서 크게 읽히도록 유지 */}
            <div className="border-l-[5px] border-[#00b859] bg-gradient-to-r from-emerald-50/90 to-white px-4 py-4 sm:px-5 sm:py-5">
              {c.message ? (
                <>
                  <p className="text-base font-semibold leading-relaxed text-slate-900 sm:text-lg sm:leading-snug">
                    &ldquo;{c.message}&rdquo;
                  </p>
                  {c.short_text_only_fallback && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 ring-1 ring-amber-100">
                      긴 칸(여러 줄)이 비어 있어 짧은 항목만 보일 수 있어요. 제출자에게 긴 칸 작성을 안내해 주세요.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm italic text-slate-500">등록된 추천 사유 텍스트가 없습니다.</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 w-full rounded-xl border border-emerald-200/80 bg-emerald-50/80 py-3 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100/90"
        >
          칭찬 더 보기 ({compliments.length - INITIAL_SHOW}건)
        </button>
      )}
    </div>
  )
}
