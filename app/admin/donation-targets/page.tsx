import Link from 'next/link'
import { getDonationTargetsForAdmin } from '@/api/actions/admin/donation-targets'
import { formatPoints } from '@/lib/formatPoints'
import { TARGET_DISPLAY_NAMES } from '@/constants/donationTargets'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { TargetAmountEdit } from './components/TargetAmountEdit'
import { OfflineDonationForm } from './components/OfflineDonationForm'

export default async function AdminDonationTargetsPage() {
  const { data: targets, error } = await getDonationTargetsForAdmin()
  const list = targets ?? []

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="기부처 관리"
        description="목표 금액 수정 및 오프라인 성금 합산을 할 수 있습니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '기부처' }]}
        actions={
          <Link
            href="/admin"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            대시보드로
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
          <p className="text-base font-medium text-gray-600">등록된 기부처가 없습니다.</p>
          <p className="mt-1 text-sm text-gray-500">시드 데이터 또는 마이그레이션을 확인해 주세요.</p>
          <Link
            href="/admin"
            className="mt-4 inline-block text-sm font-semibold text-green-600 hover:text-green-700"
          >
            대시보드로 돌아가기 →
          </Link>
        </div>
      )}

      {list.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">기부처</th>
                  <th className="px-4 py-3 font-medium text-right">목표 금액</th>
                  <th className="px-4 py-3 font-medium text-right">현재 모금액</th>
                  <th className="px-4 py-3 font-medium text-right">달성률</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">목표 수정</th>
                  <th className="px-4 py-3 font-medium">오프라인 합산</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((t) => {
                  const progress = t.target_amount > 0 ? (t.current_amount / t.target_amount) * 100 : 0
                  return (
                    <tr key={t.target_id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {TARGET_DISPLAY_NAMES[t.name] ?? t.name}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-gray-700">
                        {formatPoints(t.target_amount)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums font-medium text-gray-900">
                        {t.current_amount.toLocaleString()} C
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-gray-600">
                        {progress.toFixed(1)}%
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            t.status === 'COMPLETED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {t.status === 'COMPLETED' ? '달성 완료' : '모금 중'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <TargetAmountEdit
                          targetId={t.target_id}
                          targetName={t.name}
                          currentTargetAmount={t.target_amount}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <OfflineDonationForm targetId={t.target_id} targetName={t.name} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
