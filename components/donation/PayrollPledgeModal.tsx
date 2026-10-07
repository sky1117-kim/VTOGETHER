'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { submitPayrollPledge } from '@/api/actions/payrollPledge'
import { getDonationTargetDisplayName } from '@/constants/donationTargets'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { formatIntegerWithCommas, sanitizeIntegerInput } from '@/lib/number-format'

const PLEDGE_STEP = 10000

const QUICK_ADD = [10000, 30000, 50000] as const

/** 열림 직후 잠깐 백드롭 클릭을 무시 (같은 클릭이 백드롭으로 전달되어 바로 닫히는 현상 방지) */
const BACKDROP_CLICK_IGNORE_MS = 150

interface PayrollPledgeModalProps {
  target: {
    target_id: string
    name: string
  }
  /** 이미 신청한 금액(있다면) — 열릴 때 미리 채워준다 */
  myPledgeAmount: number
  disabled?: boolean
  children: ReactNode
}

function clampAmount(value: number): number {
  const rounded = Math.floor(value / PLEDGE_STEP) * PLEDGE_STEP
  return Math.max(rounded, 0)
}

export function PayrollPledgeModal({ target, myPledgeAmount, disabled, children }: PayrollPledgeModalProps) {
  const targetDisplayName = getDonationTargetDisplayName(target.name)
  const isEditing = myPledgeAmount > 0
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState(myPledgeAmount)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const openTimeRef = useRef<number>(0)
  const router = useRouter()

  useBodyScrollLock(isOpen)

  useEffect(() => {
    if (isOpen) {
      setAmount(myPledgeAmount)
      setError(null)
      setIsSuccess(false)
      openTimeRef.current = Date.now()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (amount < PLEDGE_STEP) {
      setError(`${PLEDGE_STEP.toLocaleString()}원 이상 입력해주세요`)
      return
    }
    if (amount % PLEDGE_STEP !== 0) {
      setError(`${PLEDGE_STEP.toLocaleString()}원 단위로 입력해주세요`)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await submitPayrollPledge(target.target_id, amount)
      if (result.error) {
        setError(result.error)
      } else {
        setIsSuccess(true)
        router.refresh()
      }
    } catch {
      setError('신청 처리 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  const addAmount = (value: number) => {
    setAmount((prev) => clampAmount(prev + value))
    setError(null)
  }

  const handleAmountInputChange = (raw: string) => {
    const digits = sanitizeIntegerInput(raw)
    setAmount(digits ? Number(digits) : 0)
    setError(null)
  }

  const handleBackdropClick = () => {
    if (Date.now() - openTimeRef.current < BACKDROP_CLICK_IGNORE_MS) return
    setIsOpen(false)
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsOpen(true)
  }

  return (
    <>
      <div onClick={handleOpen} onMouseDown={(e) => e.stopPropagation()} role="button" tabIndex={0} aria-haspopup="dialog">
        {children}
      </div>

      {typeof document !== 'undefined' &&
        isOpen &&
        createPortal(
          <div
            className="animate-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm"
            onClick={handleBackdropClick}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pledge-modal-title"
          >
            <div
              className="animate-modal-panel relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {isSuccess ? (
                <div className="text-center">
                  <div className="animate-bounce-heart mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                    <span className="text-3xl">✅</span>
                  </div>
                  <h2 className="mb-1 text-lg font-bold text-gray-900">신청 완료</h2>
                  <p className="mb-1 text-gray-700">
                    {targetDisplayName}에 <span className="font-bold">{amount.toLocaleString()}원</span> 급여공제를 신청했습니다.
                  </p>
                  <p className="mb-6 text-sm text-gray-400">실제 공제는 다음 급여 지급 시 반영됩니다.</p>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    확인
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-5 flex items-center justify-between">
                    <h2 id="pledge-modal-title" className="text-lg font-bold text-gray-900">
                      {targetDisplayName} 급여공제 신청
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

                  <p className="mb-5 text-sm text-gray-500">
                    V.Credit이 아닌 급여에서 별도로 공제되는 특별모금입니다. 신청 금액은 다음 급여 지급 시 공제됩니다.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                        신청 금액 선택 (10,000원 단위)
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {QUICK_ADD.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => addAmount(value)}
                            className="rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                          >
                            +{value.toLocaleString()}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setAmount(0); setError(null) }}
                          className="col-span-3 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                        >
                          초기화
                        </button>
                      </div>
                      <div className="mt-3">
                        <label htmlFor="pledge-amount-input" className="mb-1 block text-xs text-gray-500">
                          직접 입력
                        </label>
                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-slate-400 focus-within:bg-white">
                          <input
                            id="pledge-amount-input"
                            type="text"
                            inputMode="numeric"
                            value={formatIntegerWithCommas(amount)}
                            onChange={(e) => handleAmountInputChange(e.target.value)}
                            placeholder="0"
                            className="w-full bg-transparent text-xl font-bold text-gray-900 outline-none"
                          />
                          <span className="shrink-0 text-sm font-normal text-gray-500">원</span>
                        </div>
                      </div>
                      {isEditing && (
                        <p className="mt-1.5 text-xs text-gray-400">
                          현재 신청 금액: {myPledgeAmount.toLocaleString()}원
                        </p>
                      )}
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
                        className="btn-press flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || amount < PLEDGE_STEP}
                        className="btn-press flex-1 rounded-xl bg-slate-700 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 hover:shadow-md disabled:opacity-50"
                      >
                        {isSubmitting ? '처리 중...' : '기부하기'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
