'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteEventRound } from '@/api/actions/admin/events'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { AlertModal } from '@/components/ui/AlertModal'

interface DeleteRoundButtonProps {
  eventId: string
  roundId: string
  roundNumber: number
}

export function DeleteRoundButton({ eventId, roundId, roundNumber }: DeleteRoundButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function handleConfirmDelete() {
    setShowConfirm(false)
    setPending(true)
    try {
      const { success, error } = await deleteEventRound(eventId, roundId)
      if (success) {
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
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? '삭제 중…' : '삭제'}
      </button>
      <ConfirmModal
        isOpen={showConfirm}
        title="구간 삭제"
        message={`${roundNumber}구간을 삭제하시겠습니까?\n해당 구간에 제출된 인증이 있으면 함께 삭제됩니다.`}
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
