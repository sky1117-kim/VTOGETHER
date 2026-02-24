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
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-modal-title" className="mb-2 text-lg font-bold text-gray-900">
          {title}
        </h3>
        <p className="mb-6 whitespace-pre-line text-sm text-gray-600">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
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
