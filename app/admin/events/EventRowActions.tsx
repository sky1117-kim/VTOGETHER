'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteEvent } from '@/api/actions/admin/events'

interface EventRowActionsProps {
  eventId: string
  eventTitle: string
}

export function EventRowActions({ eventId, eventTitle }: EventRowActionsProps) {
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const ok = window.confirm(`"${eventTitle}" 이벤트를 삭제하시겠습니까?\n삭제 시 구간·보상·인증 방식·제출 이력이 함께 삭제되며 되돌릴 수 없습니다.`)
    if (!ok) return
    const { success, error } = await deleteEvent(eventId)
    if (success) {
      router.refresh()
    } else {
      alert(error ?? '삭제에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-nowrap items-center justify-start gap-2 whitespace-nowrap">
      <Link
        href={`/admin/events/${eventId}`}
        className="shrink-0 rounded-lg border border-green-600 bg-white px-2.5 py-1 text-xs font-medium text-green-600 transition hover:bg-green-50"
      >
        수정
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        className="shrink-0 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
      >
        삭제
      </button>
    </div>
  )
}
