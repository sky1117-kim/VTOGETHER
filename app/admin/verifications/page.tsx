import Link from 'next/link'
import { getPendingSubmissionsForAdmin } from '@/api/actions/admin/verifications'
import {
  getHealthActivityLogsForAdmin,
} from '@/api/actions/admin/health-challenges'
import { VerificationsTable } from './components/VerificationsTable'
import { HealthChallengeLogsTable } from './components/HealthChallengeLogsTable'
import { AdminPageHeader } from '../components/AdminPageHeader'

export default async function AdminVerificationsPage() {
  const [{ data: rows, error }, healthLogsRes] = await Promise.all([
    getPendingSubmissionsForAdmin(),
    getHealthActivityLogsForAdmin(),
  ])

  const list = rows ?? []
  const healthList = healthLogsRes.data ?? []
  const healthError = healthLogsRes.error

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="인증 심사"
        description="이벤트 참여 인증과 건강 챌린지 활동 인증을 한 화면에서 승인/반려합니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '인증 심사' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/events"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              이벤트 관리
            </Link>
          </div>
        }
      />

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">이벤트 인증</h2>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {list.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
            <p className="text-sm font-medium text-gray-600">이벤트 인증 내역이 없습니다.</p>
            <p className="mt-1 text-xs text-gray-500">직원이 이벤트 카드에서 제출하면 여기에 표시됩니다.</p>
          </div>
        )}

        {list.length > 0 && <VerificationsTable rows={list} />}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">건강 챌린지 활동 인증</h2>
        {healthError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {healthError}
          </div>
        )}
        {healthList.length === 0 && !healthError && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
            <p className="text-sm font-medium text-gray-600">건강 챌린지 제출이 없습니다.</p>
            <p className="mt-1 text-xs text-gray-500">
              시즌이 ACTIVE이고 메인에서 연 인증이 있을 때 표시됩니다.
            </p>
          </div>
        )}
        {healthList.length > 0 && <HealthChallengeLogsTable rows={healthList} />}
      </section>
    </div>
  )
}
