'use client'

import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'

interface AlertModalProps {
  isOpen: boolean
  title?: string
  message: string
  buttonLabel?: string
  variant?: 'error' | 'default'
  onClose: () => void
}

/** 브라우저 alert 대체용 커스텀 알림 모달 */
export function AlertModal({
  isOpen,
  title,
  message,
  buttonLabel = '확인',
  variant = 'default',
  onClose,
}: AlertModalProps) {
  useBodyScrollLock(isOpen)

  if (!isOpen) return null

  const isError = variant === 'error'

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h3 id="alert-modal-title" className="mb-2 text-lg font-bold text-gray-900">
            {title}
          </h3>
        )}
        <p className="mb-6 whitespace-pre-line text-sm text-gray-600">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition ${
            isError ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
