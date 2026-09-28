import Link from 'next/link'
import { getDonationTargetsForAdmin, getPayrollPledgesForAdmin } from '@/api/actions/admin/donation-targets'
import { getMatchingAmountByTarget } from '@/api/actions/admin'
import { formatPoints } from '@/lib/formatPoints'
import { TARGET_DISPLAY_NAMES, getDonationAmountUnit, getDonationFundingType } from '@/constants/donationTargets'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { TargetAmountEdit } from './components/TargetAmountEdit'
import { OfflineDonationForm } from './components/OfflineDonationForm'
import { PayrollMatchingEdit } from './components/PayrollMatchingEdit'
import { PledgeCsvDownloadButton } from './components/PledgeCsvDownloadButton'

export default async function AdminDonationTargetsPage() {
  const [{ data: targets, error }, matchingByTarget, { data: pledges }] = await Promise.all([
    getDonationTargetsForAdmin(),
    getMatchingAmountByTarget(),
    getPayrollPledgesForAdmin(),
  ])
  const list = targets ?? []
  const pledgeList = pledges ?? []
  const pledgesByTargetName = pledgeList.reduce<Record<string, typeof pledgeList>>((acc, p) => {
    ;(acc[p.target_name] ??= []).push(p)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="기부처 관리"
        description="기부처별 목표금액은 참고용 표기일 뿐이며 더 이상 자동 마감 기준으로 쓰이지 않습니다. 실제 마감은 연간 전사 목표(4,000만원) 도달 시 전체 기부처에 일괄 적용됩니다."
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

      {pledgeList.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">특별모금 급여공제 신청 내역</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                총 {pledgeList.length}건 · 급여 담당 부서에 공유할 때는 CSV로 다운로드해 전달하세요.
              </p>
            </div>
            <PledgeCsvDownloadButton pledges={pledgeList} />
          </div>
          {Object.entries(pledgesByTargetName).map(([targetName, rows]) => {
            const total = rows.reduce((sum, r) => sum + r.amount, 0)
            return (
              <div key={targetName} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <span className="font-medium text-gray-900">{TARGET_DISPLAY_NAMES[targetName] ?? targetName}</span>
                  <span className="text-sm text-gray-500">
                    신청 {rows.length}건 · 합계 <span className="font-bold text-gray-900">{total.toLocaleString()}원</span>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-gray-200 text-gray-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">이름</th>
                        <th className="px-4 py-2 font-medium">이메일</th>
                        <th className="px-4 py-2 font-medium text-right">신청 금액</th>
                        <th className="px-4 py-2 font-medium">최종 수정</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.pledge_id}>
                          <td className="px-4 py-2 text-gray-900">{r.user_name ?? '-'}</td>
                          <td className="px-4 py-2 text-gray-500">{r.user_email ?? '-'}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">
                            {r.amount.toLocaleString()}원
                          </td>
                          <td className="px-4 py-2 text-gray-400">
                            {new Date(r.updated_at).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {list.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">기부처</th>
                  <th className="px-4 py-3 font-medium text-right">참고 목표</th>
                  <th className="px-4 py-3 font-medium text-right">현재 모금액</th>
                  <th className="px-4 py-3 font-medium text-right">매칭 포함</th>
                  <th className="px-4 py-3 font-medium text-right">참고 달성률</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">목표 수정</th>
                  <th className="px-4 py-3 font-medium">오프라인 합산</th>
                  <th className="px-4 py-3 font-medium">매칭 금액(급여공제)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((t) => {
                  const isPayroll = getDonationFundingType(t.name) === '특별모금'
                  const matching = isPayroll ? t.payroll_matching_amount : (matchingByTarget[t.target_id] ?? 0)
                  const effective = t.current_amount + matching
                  const progress = t.target_amount > 0 ? (effective / t.target_amount) * 100 : 0
                  const isCompleted = t.status === 'COMPLETED'
                  const unit = getDonationAmountUnit(t.name)
                  return (
                    <tr key={t.target_id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {TARGET_DISPLAY_NAMES[t.name] ?? t.name}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-gray-700">
                        {unit === '원' ? `${t.target_amount.toLocaleString()} 원` : formatPoints(t.target_amount)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums font-medium text-gray-900">
                        {t.current_amount.toLocaleString()} {unit}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums font-bold text-gray-900">
                        {effective.toLocaleString()} {unit}
                        {matching > 0 && (
                          <span className="ml-1 text-xs font-normal text-orange-500">
                            (+{unit === '원' ? `${matching.toLocaleString()} 원` : formatPoints(matching)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-gray-600">
                        {progress.toFixed(1)}%
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            isCompleted
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {isCompleted ? '달성 완료' : '모금 중'}
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
                      <td className="px-4 py-4">
                        {isPayroll ? (
                          <PayrollMatchingEdit targetId={t.target_id} currentAmount={t.payroll_matching_amount} />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
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
