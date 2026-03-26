'use client'

import { createPortal } from 'react-dom'
import { getTargetTheme } from '@/constants/donationTargets'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { TARGET_DISPLAY_NAMES } from '@/constants/donationTargets'

/** 기부처 표시 이름 (DB명 → 화면명) */
function displayName(name: string): string {
  return TARGET_DISPLAY_NAMES[name] ?? name
}

interface DonationSuccessModalProps {
  targetName: string
  amount: number
  levelUp?: {
    fromLevel: 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'
    toLevel: 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'
    awardedMedals: number
  } | null
  onClose: () => void
}

/** 기부 완료 시 띄우는 축하 모달 (기부처 색상 + 하트 통통 모션) */
export function DonationSuccessModal({
  targetName,
  amount,
  levelUp = null,
  onClose,
}: DonationSuccessModalProps) {
  useBodyScrollLock(true) // 이 모달은 열려 있을 때만 렌더되므로 항상 잠금
  const theme = getTargetTheme(targetName)
  const name = displayName(targetName)

  // 하트 + 체크 조합 (기부 완료 상징)
  const heartIcon = (
    <span className="relative inline-flex items-center justify-center">
      <svg
        className={`h-10 w-10 ${theme.text}`}
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
      <svg
        className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white ${theme.text}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12l5 5L20 7" />
      </svg>
    </span>
  )

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/50 p-4"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="donation-success-title"
    >
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단: 통통 튀는 하트 아이콘 (기부처 색상) */}
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${theme.bg} animate-bounce-heart`}
        >
          {heartIcon}
        </div>

        <h2
          id="donation-success-title"
          className="mb-1 text-center text-lg font-bold text-gray-900"
        >
          기부 완료!
        </h2>
        <p className={`text-center font-semibold ${theme.text}`}>
          {name}에
        </p>
        <p className="mb-4 text-center text-gray-900">
          <span className="font-bold">{amount.toLocaleString()} C</span>
          를 전달했습니다.
        </p>

        {/* 감사 메시지 박스 */}
        <div className="mb-6 rounded-xl bg-gray-100 px-4 py-4 text-center text-sm text-gray-600">
          <p>당신의 작은 나눔이 모여</p>
          <p>세상을 바꾸는 큰 기회가 됩니다.</p>
          <p className="font-medium">따뜻한 마음에 진심으로 감사드립니다.</p>
        </div>

        {levelUp && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
            <p className="text-base font-bold text-emerald-800">
              축하합니다! {levelUp.toLevel === 'GREEN_MASTER' ? 'Green Master' : 'Earth Hero'} 달성
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              레벨업 보상으로 <span className="font-bold">{levelUp.awardedMedals} M</span> 이 지급되었습니다.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          확인
        </button>
      </div>
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : null
}
