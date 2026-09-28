import Image from 'next/image'
import {
  DEFAULT_TARGET_IMAGES,
  TARGET_CATEGORY_TAGS,
  DONATION_FUNDING_TYPE_INFO,
  getDonationAmountUnit,
  getDonationBreakdownSegments,
  getDonationFundingType,
  getDonationTargetDisplayName,
  getTargetTheme,
} from '@/constants/donationTargets'
import { DonationModal } from '@/components/donation/DonationModal'
import { PayrollPledgeModal } from '@/components/donation/PayrollPledgeModal'

interface DonationTarget {
  target_id: string
  name: string
  description: string | null
  image_url: string | null
  target_amount: number
  current_amount: number
  status: 'ACTIVE' | 'COMPLETED'
  payroll_matching_amount?: number
}

/** DB에 이미지가 없을 때 기부처 이름으로 기본 이미지 반환 */
function getTargetImageUrl(target: DonationTarget): string {
  return target.image_url?.trim() || DEFAULT_TARGET_IMAGES[target.name] || ''
}

/** 기부처 이름으로 좌측 상단 카테고리 태그 정보 반환 */
function getCategoryTag(target: DonationTarget) {
  return TARGET_CATEGORY_TAGS[target.name] ?? { label: '기부', className: 'bg-gray-100 text-gray-700 border-gray-300' }
}

interface DonationSectionProps {
  totalTarget: number
  totalCurrent: number
  targets: DonationTarget[]
  userPoints: number
  /** 특별모금(급여공제) 기부처별로 내가 신청한 금액 */
  myPledgesByTarget?: Record<string, number>
}

/** 기부처 카드 (일반모금/특별모금 공통) */
function DonationTargetCard({
  target,
  userPoints,
  isAnnualGoalReached,
  myPledgeAmount = 0,
}: {
  target: DonationTarget
  userPoints: number
  isAnnualGoalReached: boolean
  myPledgeAmount?: number
}) {
  const isCompleted = target.status === 'COMPLETED'
  const theme = getTargetTheme(target.name)
  const categoryTag = getCategoryTag(target)
  const fundingType = getDonationFundingType(target.name)
  const fundingTypeInfo = DONATION_FUNDING_TYPE_INFO[fundingType]
  const amountUnit = getDonationAmountUnit(target.name)
  const isPayroll = fundingType === '특별모금'
  return (
    <div
      className={`card-hover glass relative flex h-full flex-col overflow-hidden rounded-2xl shadow-soft ${
        isCompleted ? `donation-completed ring-2 ${theme.completedRing}` : ''
      }`}
    >
      {/* 좌측 상단: 카테고리 태그 (카드에서 떨어진 도형처럼) */}
      <div
        className={`absolute left-4 top-4 z-10 rounded-xl px-3 py-1.5 text-xs font-bold shadow-soft ${categoryTag.className}`}
      >
        {categoryTag.label}
      </div>
      {isCompleted && (
        <div className={`absolute right-4 top-4 z-10 rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-soft ${theme.completedBadge}`}>
          지급 완료
        </div>
      )}
      <div
        className={`relative h-40 shrink-0 ${
          isCompleted ? 'grayscale opacity-80' : ''
        } bg-gray-200`}
      >
        {getTargetImageUrl(target) ? (
          <Image
            src={getTargetImageUrl(target)}
            alt={target.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            🏢
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {/* 기부처 이름: 달성률 바로 위에 배치 (예전 DB명은 표시명으로 치환) */}
        <h3 className="mb-1 text-base font-bold text-gray-900">
          {getDonationTargetDisplayName(target.name)}
        </h3>
        <span
          className="mb-2 inline-block w-fit rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500"
          title={fundingTypeInfo.description}
        >
          {fundingTypeInfo.label}
        </span>
        <div className="mt-auto">
          <div className="mb-4">
            <span className={`block text-2xl font-bold tabular-nums tracking-tight ${theme.text}`}>
              {target.current_amount.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-gray-400">{amountUnit}</span>
            </span>
            <span className="block text-xs text-gray-400">누적 참여 금액</span>
          </div>
          {isCompleted ? (
            <div className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-bold ${theme.completedButton}`}>
              ✅ 모금 종료 · 지급 완료
            </div>
          ) : isPayroll ? (
            <>
              {myPledgeAmount > 0 && (
                <p className="mb-1.5 text-xs text-gray-400">
                  내 신청 금액: {myPledgeAmount.toLocaleString()}원
                </p>
              )}
              <PayrollPledgeModal target={target} myPledgeAmount={myPledgeAmount} disabled={isAnnualGoalReached}>
                <span
                  className={`flex w-full cursor-pointer items-center justify-center rounded-xl border-2 py-2.5 text-sm font-bold shadow-soft transition btn-press ${
                    !isAnnualGoalReached
                      ? `${theme.button} hover:shadow-soft-lg`
                      : 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400'
                  }`}
                >
                  {isAnnualGoalReached ? '목표 달성' : '기부하기'}
                </span>
              </PayrollPledgeModal>
            </>
          ) : (
            <DonationModal
              target={target}
              userPoints={userPoints}
              disabled={userPoints <= 0 || isAnnualGoalReached}
            >
              <span
                className={`flex w-full cursor-pointer items-center justify-center rounded-xl border-2 py-2.5 text-sm font-bold shadow-soft transition btn-press ${
                  userPoints > 0 && !isAnnualGoalReached
                    ? `${theme.button} hover:shadow-soft-lg`
                    : 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400'
                }`}
              >
                {isAnnualGoalReached ? '목표 달성' : '기부하기'}
              </span>
            </DonationModal>
          )}
        </div>
      </div>
    </div>
  )
}

export function DonationSection({
  totalTarget,
  totalCurrent,
  targets,
  userPoints,
  myPledgesByTarget = {},
}: DonationSectionProps) {
  const totalPercent = totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0
  const isAnnualGoalReached = totalTarget > 0 && totalCurrent >= totalTarget
  const generalTargets = targets.filter((t) => getDonationFundingType(t.name) === '일반모금')
  const specialTargets = targets.filter((t) => getDonationFundingType(t.name) === '특별모금')

  const breakdownSegments = getDonationBreakdownSegments(targets)

  return (
    <section id="voting" className="mb-16">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="section-title flex items-center gap-3 text-gray-900">
            <span className="h-8 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
            상시 기부 (V.Credit)
          </h2>
          <p className="mt-1 text-gray-500">
            연간 전사 기부 목표 <strong className="text-green-700">4,000만원</strong> 달성 시
            상시 기부가 마감됩니다.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            <strong className="font-semibold text-gray-500">일반모금</strong>은 보유한 V.Credit(적립한 V.Medal을 전환한 크레딧 포함)으로 참여하고,{' '}
            <strong className="font-semibold text-gray-500">특별모금</strong>은 재난 등 긴급 이슈에 맞춰 급여에서 별도로 공제해 참여합니다.
          </p>
        </div>
      </div>

      {isAnnualGoalReached && (
        <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <p className="font-semibold">🏆 올해 전사 기부 목표 {totalTarget.toLocaleString()}원을 달성했습니다!</p>
          <p className="mt-1">뜨거운 관심과 참여에 감사드립니다. 올해 상시 기부는 여기서 마무리되며, 내년 시즌에 다시 만나요 :)</p>
        </div>
      )}

      {/* 전사 누적 기부액 — 강조 영역 */}
      <div className="glass card-hover relative mb-8 overflow-hidden rounded-2xl border border-green-200/70 bg-gradient-to-br from-green-50 via-white to-white px-4 py-5 shadow-soft sm:px-8 sm:py-8">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-200/25 blur-3xl"
          aria-hidden
        />
        <div className="relative mb-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-[0.14em] text-green-700 sm:text-sm">
              전사 누적 기부액
            </span>
            <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="break-all text-3xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
                {totalCurrent.toLocaleString()}
              </span>
              <span className="break-all text-base text-gray-400 sm:text-xl md:text-2xl">
                / {totalTarget.toLocaleString()}원
              </span>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <span className="block text-2xl font-bold tabular-nums text-emerald-600 sm:text-4xl md:text-5xl">
              {Math.round(totalPercent)}%
            </span>
            <span className="block text-sm font-medium text-gray-500">전체 달성률</span>
          </div>
        </div>

        <div className="relative flex h-5 w-full gap-[3px] overflow-hidden rounded-full bg-gray-200/80 sm:h-6">
          {breakdownSegments.map((seg) => (
            <div
              key={seg.key}
              className={`h-full ${seg.colorClass} transition-[width] duration-500`}
              style={{ width: `${totalTarget > 0 ? (seg.amount / totalTarget) * 100 : 0}%` }}
              title={`${seg.label} · ${seg.amount.toLocaleString()}원`}
            />
          ))}
        </div>

        {breakdownSegments.length > 0 && (
          <div className="relative mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {breakdownSegments.map((seg) => (
              <span key={seg.key} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`h-2 w-2 shrink-0 rounded-full ${seg.colorClass}`} aria-hidden />
                {seg.label}
                <span className="font-semibold tabular-nums text-gray-700">{seg.amount.toLocaleString()}원</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {targets.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center shadow-soft">
          <p className="text-gray-500">등록된 기부처가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-10">
          <div>
            <div className="mb-4 flex items-baseline gap-2.5">
              <span className="h-5 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
              <h3 className="text-base font-bold text-gray-900">일반모금</h3>
              <span className="hidden text-sm text-gray-400 sm:inline">보유한 V.Credit(적립한 V.Medal을 전환한 크레딧 포함)으로 참여</span>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {generalTargets.map((target) => (
                <DonationTargetCard
                  key={target.target_id}
                  target={target}
                  userPoints={userPoints}
                  isAnnualGoalReached={isAnnualGoalReached}
                />
              ))}
            </div>
          </div>

          {specialTargets.length > 0 && (
            <div className="border-t border-gray-100 pt-10">
              <div className="mb-4 flex items-baseline gap-2.5">
                <span className="h-5 w-1 shrink-0 rounded-full bg-slate-500" aria-hidden />
                <h3 className="text-base font-bold text-gray-900">특별모금</h3>
                <span className="hidden text-sm text-gray-400 sm:inline">재난 등 긴급 이슈에 대응해 급여에서 별도로 공제해 참여</span>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {specialTargets.map((target) => (
                  <DonationTargetCard
                    key={target.target_id}
                    target={target}
                    userPoints={userPoints}
                    isAnnualGoalReached={isAnnualGoalReached}
                    myPledgeAmount={myPledgesByTarget[target.target_id] ?? 0}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
