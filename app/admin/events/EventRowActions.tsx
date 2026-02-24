'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteEvent } from '@/api/actions/admin/events'
import { ExportEventExcelButton } from './components/ExportEventExcelButton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { AlertModal } from '@/components/ui/AlertModal'

interface EventRowActionsProps {
  eventId: string
  eventTitle: string
}

export function EventRowActions({ eventId, eventTitle }: EventRowActionsProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function handleConfirmDelete() {
    setShowConfirm(false)
    const { success, error } = await deleteEvent(eventId)
    if (success) {
      router.refresh()
    } else {
      setAlertMessage(error ?? '삭제에 실패했습니다.')
    }
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirm(true)
  }

  return (
    <div className="flex flex-nowrap items-center justify-start gap-2 whitespace-nowrap">
      <ExportEventExcelButton eventId={eventId} eventTitle={eventTitle} variant="row" />
      <Link
        href={`/admin/events/${eventId}`}
        className="shrink-0 rounded-lg border border-green-600 bg-white px-2.5 py-1 text-xs font-medium text-green-600 transition hover:bg-green-50 btn-press-link"
      >
        수정
      </Link>
      <button
        type="button"
        onClick={handleDeleteClick}
        className="shrink-0 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 btn-press-link"
      >
        삭제
      </button>
      <ConfirmModal
        isOpen={showConfirm}
        title="이벤트 삭제"
        message={`"${eventTitle}" 이벤트를 삭제하시겠습니까?\n삭제 시 구간·보상·인증 방식·제출 이력이 함께 삭제되며 되돌릴 수 없습니다.`}
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
    </div>
  )
}
