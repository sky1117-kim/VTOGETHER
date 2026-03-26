'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { donatePoints } from '@/api/actions/donation'
import { useRouter } from 'next/navigation'
import { DonationSuccessModal } from './DonationSuccessModal'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'

const DONATION_STEP = 1000

const QUICK_ADD = [1000, 5000, 10000] as const

/** 열림 직후 잠깐 백드롭 클릭을 무시 (같은 클릭이 백드롭으로 전달되어 바로 닫히는 현상 방지) */
const BACKDROP_CLICK_IGNORE_MS = 150

interface DonationModalProps {
  target: {
    target_id: string
    name: string
    target_amount: number
    current_amount: number
  }
  userPoints: number
  disabled?: boolean
  children: ReactNode
}

function clampAmount(value: number, max: number): number {
  const rounded = Math.floor(value / DONATION_STEP) * DONATION_STEP
  return Math.min(Math.max(rounded, 0), max)
}

export function DonationModal({ target, userPoints, disabled, children }: DonationModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successPayload, setSuccessPayload] = useState<{
    targetName: string
    amount: number
    levelUp?: {
      fromLevel: 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'
      toLevel: 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'
      awardedMedals: number
    } | null
  } | null>(null)
  const openTimeRef = useRef<number>(0)
  const router = useRouter()

  // 모달 열림 시 배경 스크롤 방지
  useBodyScrollLock(isOpen)

  // 모달이 열릴 때마다 선택 금액·에러 초기화 (깜빡임 방지)
  useEffect(() => {
    if (isOpen) {
      setAmount(0)
      setError(null)
      openTimeRef.current = Date.now()
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (amount < DONATION_STEP) {
      setError(`${DONATION_STEP.toLocaleString()} P 이상 선택해주세요`)
      return
    }
    if (amount > userPoints) {
      setError('보유 포인트를 초과할 수 없습니다')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await donatePoints(target.target_id, amount)
      if (result.error) {
        setError(result.error)
      } else {
        setIsOpen(false)
        setAmount(0)
        setSuccessPayload({ targetName: target.name, amount, levelUp: result.levelUp ?? null })
        router.refresh()
      }
    } catch (err) {
      setError('기부 처리 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  const addAmount = (value: number) => {
    setAmount((prev) => clampAmount(prev + value, userPoints))
    setError(null)
  }

  const setFullAmount = () => {
    setAmount(clampAmount(userPoints, userPoints))
    setError(null)
  }

  const displayAmount = amount > 0 ? amount.toLocaleString() : ''

  const handleBackdropClick = () => {
    if (Date.now() - openTimeRef.current < BACKDROP_CLICK_IGNORE_MS) return
    setIsOpen(false)
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsOpen(true)
  }

  const handleCloseSuccess = () => {
    setSuccessPayload(null)
  }

  return (
    <>
      <div onClick={handleOpen} onMouseDown={(e) => e.stopPropagation()} role="button" tabIndex={0} aria-haspopup="dialog">
        {children}
      </div>

      {successPayload && (
        <DonationSuccessModal
          targetName={successPayload.targetName}
          amount={successPayload.amount}
          levelUp={successPayload.levelUp ?? null}
          onClose={handleCloseSuccess}
        />
      )}

      {typeof document !== 'undefined' &&
        isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/50 p-4"
            onClick={handleBackdropClick}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="donation-modal-title"
          >
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="donation-modal-title" className="text-lg font-bold text-gray-900">
                {target.name}에 기부하기
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="닫기"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                  금액 선택 (1,000 P 단위)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_ADD.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => addAmount(value)}
                      className="rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                    >
                      +{value.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={setFullAmount}
                    className="col-span-3 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                  >
                    전액 ({userPoints.toLocaleString()} P)
                  </button>
                </div>
                <div className="mt-3 flex items-baseline justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-500">선택 금액</span>
                  <span className="text-xl font-bold text-gray-900">
                    {displayAmount || '0'} <span className="text-sm font-normal text-gray-500">P</span>
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  보유: {userPoints.toLocaleString()} P
                </p>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || amount < DONATION_STEP}
                  className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 btn-press"
                >
                  {isSubmitting ? '처리 중...' : '기부하기'}
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}
    </>
  )
}
