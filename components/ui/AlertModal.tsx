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
      <div
        className="animate-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="animate-modal-panel relative z-10 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            isError ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
          }`}
          aria-hidden
        >
          {isError ? (
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M12 3.5c4.7 0 8.5 3.8 8.5 8.5s-3.8 8.5-8.5 8.5-8.5-3.8-8.5-8.5S7.3 3.5 12 3.5Z" />
            </svg>
          ) : (
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
        </div>
        {title && (
          <h3 id="alert-modal-title" className="mb-1.5 text-center text-lg font-bold text-gray-900">
            {title}
          </h3>
        )}
        <p className="mb-6 whitespace-pre-line text-center text-sm text-gray-600">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className={`btn-press w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition ${
            isError ? 'bg-red-600 hover:bg-red-700 hover:shadow-md' : 'bg-green-600 hover:bg-green-700 hover:shadow-md'
          }`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
