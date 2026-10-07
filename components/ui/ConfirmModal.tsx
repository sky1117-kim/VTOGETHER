'use client'

import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'

interface ConfirmModalProps {
  isOpen: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

/** 브라우저 confirm 대체용 커스텀 확인 모달 */
export function ConfirmModal({
  isOpen,
  title = '확인',
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useBodyScrollLock(isOpen)

  if (!isOpen) return null

  const isDanger = variant === 'danger'

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="animate-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div
        className="animate-modal-panel relative z-10 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            isDanger ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
          }`}
          aria-hidden
        >
          {isDanger ? (
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1.5 1.5 0 0 0 3.5 20h17a1.5 1.5 0 0 0 1.39-1.96L13.71 3.86a1.5 1.5 0 0 0-2.72 0Z" />
            </svg>
          ) : (
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M12 3.5c4.7 0 8.5 3.8 8.5 8.5s-3.8 8.5-8.5 8.5-8.5-3.8-8.5-8.5S7.3 3.5 12 3.5Z" />
            </svg>
          )}
        </div>
        <h3 id="confirm-modal-title" className="mb-1.5 text-center text-lg font-bold text-gray-900">
          {title}
        </h3>
        <p className="mb-6 whitespace-pre-line text-center text-sm text-gray-600">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`btn-press flex-1 rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition ${
              isDanger ? 'bg-red-600 hover:bg-red-700 hover:shadow-md' : 'bg-green-600 hover:bg-green-700 hover:shadow-md'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
