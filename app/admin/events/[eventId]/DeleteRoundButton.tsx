'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteEventRound } from '@/api/actions/admin/events'

interface DeleteRoundButtonProps {
  eventId: string
  roundId: string
  roundNumber: number
}

export function DeleteRoundButton({ eventId, roundId, roundNumber }: DeleteRoundButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    const ok = window.confirm(
      `${roundNumber}구간을 삭제하시겠습니까?\n해당 구간에 제출된 인증이 있으면 함께 삭제됩니다.`
    )
    if (!ok) return
    setPending(true)
    try {
      const { success, error } = await deleteEventRound(eventId, roundId)
      if (success) {
        router.refresh()
      } else {
        alert(error ?? '삭제에 실패했습니다.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? '삭제 중…' : '삭제'}
    </button>
  )
}
