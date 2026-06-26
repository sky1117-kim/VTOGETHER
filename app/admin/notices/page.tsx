import { getNoticesForAdmin } from '@/api/actions/notices'
import { AdminNoticeManager } from './AdminNoticeManager'

export default async function AdminNoticesPage() {
  const notices = await getNoticesForAdmin()
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">회사 소식 관리</h1>
        <p className="mt-0.5 text-sm text-gray-500">소식을 등록하면 메인 소식 탭에 표시됩니다.</p>
      </div>
      <AdminNoticeManager notices={notices} />
    </div>
  )
}
