import Image from 'next/image'
import {
  DEFAULT_TARGET_IMAGES,
  DONATION_FUNDING_TYPE_INFO,
  getDonationAmountUnit,
  getDonationFundingType,
  getDonationTargetDisplayName,
  getTargetTheme,
} from '@/constants/donationTargets'
import { DonationModal } from './DonationModal'
import { PayrollPledgeModal } from './PayrollPledgeModal'

interface DonationCardProps {
  target: {
    target_id: string
    name: string
    description: string | null
    image_url: string | null
    target_amount: number
    current_amount: number
    status: 'ACTIVE' | 'COMPLETED'
  }
  userPoints: number
  /** 특별모금(급여공제)인 경우, 내가 이미 신청한 금액 */
  myPledgeAmount?: number
}

export function DonationCard({ target, userPoints, myPledgeAmount = 0 }: DonationCardProps) {
  const displayName = getDonationTargetDisplayName(target.name)
  const isCompleted = target.status === 'COMPLETED'
  const isPayroll = getDonationFundingType(target.name) === '특별모금'
  const canDonate = !isCompleted && userPoints > 0
  const fundingTypeInfo = DONATION_FUNDING_TYPE_INFO[getDonationFundingType(target.name)]
  const theme = getTargetTheme(target.name)
  const amountUnit = getDonationAmountUnit(target.name)
  const imageUrl = target.image_url?.trim() || DEFAULT_TARGET_IMAGES[target.name] || ''

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition hover:shadow-xl ${
        isCompleted
          ? `donation-completed ${theme.completedBorder}`
          : 'border-gray-200 bg-white'
      }`}
    >
      {isCompleted && (
        <div className={`absolute right-0 top-0 z-10 rounded-bl-xl px-3 py-1 text-xs font-bold text-white shadow-sm ${theme.completedBadge}`}>
          지급 완료
        </div>
      )}

      <div className={`relative h-40 shrink-0 ${isCompleted ? 'grayscale opacity-80' : ''} bg-gray-200`}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={displayName}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            🏢
          </div>
        )}
        <div className="absolute left-3 top-3 max-w-[min(100%-1.5rem,14rem)] rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-gray-800 shadow-sm">
          <span className="block truncate" title={displayName}>
            {displayName}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
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
              <PayrollPledgeModal target={target} myPledgeAmount={myPledgeAmount}>
                <button
                  type="button"
                  className={`w-full rounded-xl border-2 py-2.5 text-sm font-bold transition active:scale-95 flex items-center justify-center gap-2 ${theme.button}`}
                >
                  기부하기
                </button>
              </PayrollPledgeModal>
            </>
          ) : (
            <DonationModal target={target} userPoints={userPoints} disabled={!canDonate}>
              <button
                type="button"
                disabled={!canDonate}
                className={`w-full rounded-xl border-2 py-2.5 text-sm font-bold transition active:scale-95 flex items-center justify-center gap-2 ${
                  canDonate
                    ? `${theme.button}`
                    : 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400'
                }`}
              >
                {canDonate ? '기부하기' : '포인트 부족'}
              </button>
            </DonationModal>
          )}
        </div>
      </div>
    </div>
  )
}
