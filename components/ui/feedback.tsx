'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { ConfirmModal } from './ConfirmModal'
import { AlertModal } from './AlertModal'

type ToastVariant = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; variant: ToastVariant }

type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
}
type AlertOptions = {
  title?: string
  message: string
  buttonLabel?: string
  variant?: 'error' | 'default'
}

type FeedbackContextValue = {
  /** 잠시 떴다 사라지는 알림 (성공/실패 결과 안내용) */
  toast: (message: string, variant?: ToastVariant) => void
  /** 브라우저 confirm 대체. 확인 시 true */
  confirm: (options: ConfirmOptions | string) => Promise<boolean>
  /** 브라우저 alert 대체. 닫힐 때 resolve */
  alert: (options: AlertOptions | string) => Promise<void>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

const TOAST_DURATION: Record<ToastVariant, number> = { success: 2800, info: 3200, error: 5000 }

/** 앱 전역 토스트·확인·알림 모달 제공자 (루트 레이아웃에서 1회 마운트) */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const [alertState, setAlertState] = useState<(AlertOptions & { resolve: () => void }) | null>(null)
  const [mounted, setMounted] = useState(false)
  const idRef = useRef(0)

  useEffect(() => {
    // 포털 대상(document.body)은 클라이언트 마운트 후에만 사용 가능
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = ++idRef.current
      setToasts((prev) => [...prev.slice(-2), { id, message, variant }])
      window.setTimeout(() => dismiss(id), TOAST_DURATION[variant])
    },
    [dismiss]
  )

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve }))
  }, [])

  const alert = useCallback((options: AlertOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise<void>((resolve) => setAlertState({ ...opts, resolve }))
  }, [])

  const value = useMemo(() => ({ toast, confirm, alert }), [toast, confirm, alert])

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result)
    setConfirmState(null)
  }
  const closeAlert = () => {
    alertState?.resolve()
    setAlertState(null)
  }

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ConfirmModal
        isOpen={confirmState != null}
        title={confirmState?.title}
        message={confirmState?.message ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        variant={confirmState?.variant}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
      <AlertModal
        isOpen={alertState != null}
        title={alertState?.title}
        message={alertState?.message ?? ''}
        buttonLabel={alertState?.buttonLabel}
        variant={alertState?.variant}
        onClose={closeAlert}
      />
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-4 z-[10000] flex flex-col items-center gap-2 px-4 sm:bottom-6"
            aria-live="polite"
            role="status"
          >
            {toasts.map((t) => (
              <ToastView key={t.id} item={t} onClose={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body
        )}
    </FeedbackContext.Provider>
  )
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const Icon = item.variant === 'success' ? CheckCircle2 : item.variant === 'error' ? AlertCircle : Info
  const tone =
    item.variant === 'success'
      ? 'text-emerald-400'
      : item.variant === 'error'
        ? 'text-red-400'
        : 'text-sky-300'
  return (
    <div className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl bg-gray-900/95 px-4 py-3 text-sm text-white shadow-modal backdrop-blur">
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} aria-hidden />
      <p className="min-w-0 flex-1 whitespace-pre-line break-words">{item.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="-mr-1 shrink-0 rounded p-0.5 text-gray-400 hover:text-white"
        aria-label="알림 닫기"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback은 FeedbackProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
