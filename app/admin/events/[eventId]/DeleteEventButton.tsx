'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteEvent } from '@/api/actions/admin/events'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { AlertModal } from '@/components/ui/AlertModal'

interface DeleteEventButtonProps {
  eventId: string
  eventTitle: string
}

export function DeleteEventButton({ eventId, eventTitle }: DeleteEventButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function handleConfirmDelete() {
    setShowConfirm(false)
    setPending(true)
    try {
      const { success, error } = await deleteEvent(eventId)
      if (success) {
        router.push('/admin/events')
        router.refresh()
      } else {
        setAlertMessage(error ?? '삭제에 실패했습니다.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={pending}
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
      >
        {pending ? '삭제 중…' : '이벤트 삭제'}
      </button>
      <ConfirmModal
        isOpen={showConfirm}
        title="이벤트 삭제"
        message={`"${eventTitle}" 이벤트를 삭제하시겠습니까?\n삭제 시 해당 이벤트의 구간·보상·인증 방식·제출 이력이 함께 삭제되며 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirm(false)}
      />
      <AlertModal
        isOpen={!!alertMessage}
        title="삭제 실패"
        message={alertMessage ?? ''}
        variant="error"
        onClose={() => setAlertMessage(null)}
      />
    </>
  )
}
