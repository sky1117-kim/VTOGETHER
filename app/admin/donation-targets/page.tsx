import Link from 'next/link'
import { getDonationTargetsForAdmin } from '@/api/actions/admin/donation-targets'
import { getOverTargetDonors, getMatchingAmountByTarget } from '@/api/actions/admin'
import { formatPoints } from '@/lib/formatPoints'
import { TARGET_DISPLAY_NAMES } from '@/constants/donationTargets'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { TargetAmountEdit } from './components/TargetAmountEdit'
import { OfflineDonationForm } from './components/OfflineDonationForm'

export default async function AdminDonationTargetsPage() {
  const [{ data: targets, error }, matchingByTarget] = await Promise.all([
    getDonationTargetsForAdmin(),
    getMatchingAmountByTarget(),
  ])
  const list = targets ?? []

  // 매칭 포함 effective amount 기준으로 초과 타겟 찾기
  const overTargets = list.filter((t) => {
    const effective = t.current_amount + (matchingByTarget[t.target_id] ?? 0)
    return effective > t.target_amount
  })
  const overTargetResults = await Promise.all(
    overTargets.map((t) => getOverTargetDonors(t.target_id))
  )

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
                  <th className="px-4 py-3 font-medium text-right">매칭 포함</th>
                  <th className="px-4 py-3 font-medium text-right">달성률</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">목표 수정</th>
                  <th className="px-4 py-3 font-medium">오프라인 합산</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((t) => {
                  const matching = matchingByTarget[t.target_id] ?? 0
                  const effective = t.current_amount + matching
                  const progress = t.target_amount > 0 ? (effective / t.target_amount) * 100 : 0
                  const isOver = effective > t.target_amount
                  const isCompleted = t.status === 'COMPLETED' || effective >= t.target_amount
                  return (
                    <tr key={t.target_id} className={`hover:bg-gray-50 ${isOver ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {TARGET_DISPLAY_NAMES[t.name] ?? t.name}
                        {isOver && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">초과</span>}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-gray-700">
                        {formatPoints(t.target_amount)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums font-medium text-gray-900">
                        {t.current_amount.toLocaleString()} C
                      </td>
                      <td className={`px-4 py-4 text-right tabular-nums font-bold ${isOver ? 'text-red-700' : 'text-gray-900'}`}>
                        {effective.toLocaleString()} C
                        {matching > 0 && <span className="ml-1 text-xs font-normal text-orange-500">(+{formatPoints(matching)})</span>}
                      </td>
                      <td className={`px-4 py-4 text-right tabular-nums ${isOver ? 'font-bold text-red-700' : 'text-gray-600'}`}>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 초과 기부 — Credit 반환 대상자 */}
      {overTargets.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-red-700">⚠ 목표 초과 기부 — Credit 반환 대상</h2>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              {overTargetResults.reduce((sum, r) => sum + r.data.length, 0)}건
            </span>
          </div>
          <p className="text-sm text-gray-600">
            목표 금액 달성 이후에 접수된 온라인 기부입니다. <strong>초과분</strong>만큼 Credit을 반환해야 합니다.
            오프라인 합산으로 초과된 경우 온라인 기록이 0건일 수 있습니다.
          </p>
          {overTargetResults.map((result, i) => {
            const target = overTargets[i]
            const matching = matchingByTarget[target.target_id] ?? 0
            const effectiveAmount = target.current_amount + matching
            const overAmount = effectiveAmount - target.target_amount
            return (
              <div key={target.target_id} className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
                <div className="border-b border-red-100 bg-red-50 px-5 py-3 flex items-center justify-between gap-4">
                  <p className="text-sm font-bold text-red-800">
                    {TARGET_DISPLAY_NAMES[result.targetName] ?? result.targetName}
                    <span className="ml-2 font-normal text-red-600">목표 {formatPoints(result.targetAmount)}</span>
                  </p>
                  <span className="shrink-0 text-xs font-semibold text-red-700">
                    초과 {formatPoints(overAmount)} (매칭 {formatPoints(matching)} 포함)
                  </span>
                </div>
                {result.data.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-500">
                    온라인 기부 기록 없음 — 오프라인 합산 또는 매칭으로 초과된 케이스입니다. 수동으로 처리해 주세요.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="px-4 py-2 font-medium">이름</th>
                          <th className="px-4 py-2 font-medium">이메일</th>
                          <th className="px-4 py-2 font-medium text-right">기부액</th>
                          <th className="px-4 py-2 font-medium text-right text-red-700">반환할 초과분</th>
                          <th className="px-4 py-2 font-medium">기부 시각</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {result.data.map((row) => (
                          <tr key={row.donation_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{row.user_name ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{row.user_email ?? '—'}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-900">{row.amount.toLocaleString()} C</td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-red-700">{row.excess.toLocaleString()} C</td>
                            <td className="px-4 py-3 text-xs tabular-nums text-gray-500">
                              {new Date(row.created_at).toLocaleString('ko-KR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-gray-200 bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-xs font-medium text-gray-500">합계</td>
                          <td className="px-4 py-2 text-right tabular-nums text-sm font-bold text-red-700">
                            {result.data.reduce((sum, r) => sum + r.excess, 0).toLocaleString()} C
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
