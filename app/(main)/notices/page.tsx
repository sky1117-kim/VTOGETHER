import { getCurrentUser } from '@/api/actions/auth'
import { getNotices } from '@/api/queries/notices'
import { NoticeList } from '@/components/notices/NoticeList'
import { Megaphone } from 'lucide-react'

export default async function NoticesPage() {
  const user = await getCurrentUser()
  const notices = await getNotices(user?.id ?? null)

  return (
    <div className="mx-auto max-w-7xl px-3 pb-24 pt-0 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="block h-7 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
        <Megaphone className="size-5 text-green-600 shrink-0" />
        <h1 className="text-xl font-black text-gray-900">회사 소식</h1>
        <span className="hidden text-sm text-gray-400 sm:block">VNTG의 소식과 이야기를 전합니다.</span>
      </div>

      <NoticeList notices={notices} currentUserId={user?.id ?? null} />
    </div>
  )
}
