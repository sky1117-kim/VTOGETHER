import Link from 'next/link'
import { getCurrentUser } from '@/api/actions/auth'
import { redirect } from 'next/navigation'
import { CreateEventForm } from './CreateEventForm'

export default async function AdminEventsNewPage() {
  const user = await getCurrentUser()
  if (!user?.user_id) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/events"
          className="text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          ← 이벤트 목록
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">새 이벤트 등록</h2>
        <p className="mt-1 text-gray-500">이벤트 & 챌린지 정보와 인증 방식을 설정합니다.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <CreateEventForm createdBy={user.user_id} />
      </div>
    </div>
  )
}
