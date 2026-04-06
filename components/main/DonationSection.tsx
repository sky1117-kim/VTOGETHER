import Image from 'next/image'
import {
  DEFAULT_TARGET_IMAGES,
  TARGET_CATEGORY_TAGS,
  getDonationTargetDisplayName,
  getTargetTheme,
} from '@/constants/donationTargets'
import { DonationModal } from '@/components/donation/DonationModal'

interface DonationTarget {
  target_id: string
  name: string
  description: string | null
  image_url: string | null
  target_amount: number
  current_amount: number
  status: 'ACTIVE' | 'COMPLETED'
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
}

export function DonationSection({
  totalTarget,
  totalCurrent,
  targets,
  userPoints,
}: DonationSectionProps) {
  const totalPercent = totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0

  return (
    <section id="voting" className="mb-16">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="section-title flex items-center gap-3 text-gray-900">
            <span className="h-8 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
            상시 기부 (V.Credit)
          </h2>
          <p className="mt-1 text-gray-500">
            기부처별 목표 <strong className="text-green-700">1,000만원</strong> 달성 시
            해당 모금은 마감됩니다.
          </p>
        </div>
      </div>

      {/* 전사 누적 기부액 — 강조 영역 */}
      <div className="glass card-hover mb-8 rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50/80 to-white px-4 py-5 shadow-soft sm:px-8 sm:py-8">
        <div className="mb-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-wide text-green-700 sm:text-base">
              전사 누적 기부액 (Total Progress)
            </span>
            <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="break-all text-2xl font-bold tabular-nums text-gray-900 sm:text-4xl md:text-5xl">
                {totalCurrent.toLocaleString()}
              </span>
              <span className="break-all text-base text-gray-500 sm:text-xl md:text-2xl">
                / {totalTarget.toLocaleString()} C
              </span>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <span className="block text-2xl font-bold tabular-nums text-green-600 sm:text-4xl md:text-5xl">
              {Math.round(totalPercent)}%
            </span>
            <span className="block text-sm font-medium text-gray-600">전체 달성률</span>
          </div>
        </div>
        <div className="h-5 w-full overflow-hidden rounded-full bg-gray-200 sm:h-6">
          <div
            className="progress-bar h-5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 sm:h-6"
            style={{ width: `${totalPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {targets.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center shadow-soft">
            <p className="text-gray-500">등록된 기부처가 없습니다.</p>
          </div>
        ) : targets.map((target) => {
          const percent =
            target.target_amount > 0
              ? Math.min((target.current_amount / target.target_amount) * 100, 100)
              : 0
          const isCompleted = target.status === 'COMPLETED'
          const theme = getTargetTheme(target.name)
          const categoryTag = getCategoryTag(target)
          return (
            <div
              key={target.target_id}
              className={`card-hover glass relative flex h-full flex-col overflow-hidden rounded-2xl shadow-soft ${
                isCompleted ? 'donation-completed ring-2 ring-yellow-400/50' : ''
              }`}
            >
              {/* 좌측 상단: 카테고리 태그 (카드에서 떨어진 도형처럼) */}
              <div
                className={`absolute left-4 top-4 z-10 rounded-xl px-3 py-1.5 text-xs font-bold shadow-soft ${categoryTag.className}`}
              >
                {categoryTag.label}
              </div>
              {isCompleted && (
                <div className="absolute right-4 top-4 z-10 rounded-xl bg-yellow-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft">
                  Goal Reached!
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
                <h3 className="mb-2 text-base font-bold text-gray-900">
                  {getDonationTargetDisplayName(target.name)}
                </h3>
                <div className="mt-auto">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-bold text-gray-700">
                      {target.current_amount.toLocaleString()} C
                    </span>
                    <span className="text-gray-400">{Math.round(percent)}%</span>
                  </div>
                  <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`progress-bar h-2 rounded-full ${theme.progress}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {isCompleted ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-yellow-500 bg-yellow-500 py-2.5 text-sm font-bold text-white opacity-80">
                      🏆 달성 완료
                    </div>
                  ) : (
                    <DonationModal
                      target={target}
                      userPoints={userPoints}
                      disabled={userPoints <= 0}
                    >
                      <span
                        className={`flex w-full cursor-pointer items-center justify-center rounded-xl border-2 py-2.5 text-sm font-bold shadow-soft transition btn-press ${
                          userPoints > 0
                            ? `${theme.button} hover:shadow-soft-lg`
                            : 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400'
                        }`}
                      >
                        기부하기
                      </span>
                    </DonationModal>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
