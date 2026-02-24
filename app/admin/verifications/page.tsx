import { getPendingSubmissionsForAdmin } from '@/api/actions/admin/verifications'
import { VerificationsTable } from './components/VerificationsTable'

export default async function AdminVerificationsPage() {
  const { data: rows, error } = await getPendingSubmissionsForAdmin()
  const list = rows ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">인증 심사</h1>
        <p className="mt-2 text-sm text-gray-600">이벤트 참여 인증을 승인/반려합니다. 승인·반려된 내역은 회색으로 표시됩니다.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {list.length === 0 && !error && (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-500">인증 내역이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-400">새로운 인증이 제출되면 여기에 표시됩니다.</p>
        </div>
      )}

      {list.length > 0 && <VerificationsTable rows={list} />}
    </div>
  )
}
