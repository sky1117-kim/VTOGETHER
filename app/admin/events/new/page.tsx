import Link from 'next/link'
import { getCurrentUser } from '@/api/actions/auth'
import { getEventsForAdmin } from '@/api/actions/admin/events'
import { redirect } from 'next/navigation'
import { CreateEventForm } from './CreateEventForm'

export default async function AdminEventsNewPage() {
  const user = await getCurrentUser()
  if (!user?.user_id) {
    redirect('/login')
  }
  const { data: events } = await getEventsForAdmin()
  const eventList = events ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      {/* 헤더: 명확한 시각적 계층 */}
      <header>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-emerald-600"
        >
          <span aria-hidden>←</span>
          이벤트 목록
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          새 이벤트 등록
        </h1>
        <p className="mt-1.5 text-base text-gray-600">
          이벤트 & 챌린지 정보와 인증 방식을 설정합니다.
        </p>
      </header>

      <CreateEventForm createdBy={user.user_id} existingEvents={eventList} />
    </div>
  )
}
