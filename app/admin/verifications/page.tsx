import Link from 'next/link'
import { getPendingSubmissionsForAdmin } from '@/api/actions/admin/verifications'
import { VerificationsTable } from './components/VerificationsTable'

export default async function AdminVerificationsPage() {
  const { data: rows, error } = await getPendingSubmissionsForAdmin()
  const list = rows ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">인증 심사</h1>
          <p className="mt-1 text-sm text-gray-500">
            이벤트 참여 인증을 승인하거나 반려할 수 있습니다. 여러 건 선택 후 일괄 처리할 수 있습니다.
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          대시보드로
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {list.length === 0 && !error && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          승인 대기 중인 인증이 없습니다.
        </div>
      )}

      {list.length > 0 && <VerificationsTable rows={list} />}
    </div>
  )
}
