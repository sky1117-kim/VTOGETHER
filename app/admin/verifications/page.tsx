import Link from 'next/link'
import { getPendingSubmissionsForAdmin } from '@/api/actions/admin/verifications'
import { VerificationsTable } from './components/VerificationsTable'
import { AdminPageHeader } from '../components/AdminPageHeader'

export default async function AdminVerificationsPage() {
  const { data: rows, error } = await getPendingSubmissionsForAdmin()
  const list = rows ?? []

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="인증 심사"
        description="이벤트 참여 인증을 승인/반려합니다. 승인·반려된 내역은 회색으로 표시됩니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '인증 심사' }]}
        actions={
          <Link
            href="/admin/events"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            이벤트 관리
          </Link>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {list.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
          <p className="text-base font-medium text-gray-600">인증 내역이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-500">새로운 인증이 제출되면 여기에 표시됩니다.</p>
          <Link
            href="/admin"
            className="mt-4 inline-block text-sm font-semibold text-green-600 hover:text-green-700"
          >
            대시보드로 돌아가기 →
          </Link>
        </div>
      )}

      {list.length > 0 && <VerificationsTable rows={list} />}
    </div>
  )
}
