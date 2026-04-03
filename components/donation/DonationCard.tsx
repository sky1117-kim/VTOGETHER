import Image from 'next/image'
import { DonationModal } from './DonationModal'

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
}

export function DonationCard({ target, userPoints }: DonationCardProps) {
  const progress = target.target_amount > 0 
    ? (target.current_amount / target.target_amount) * 100 
    : 0
  const isCompleted = target.status === 'COMPLETED'
  const canDonate = !isCompleted && userPoints > 0

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition hover:shadow-xl ${
        isCompleted
          ? 'donation-completed border-yellow-400'
          : 'border-gray-200 bg-white'
      }`}
    >
      {isCompleted && (
        <div className="absolute right-0 top-0 z-10 rounded-bl-xl bg-yellow-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
          Goal Reached! 🏆
        </div>
      )}

      <div className={`relative h-40 shrink-0 ${isCompleted ? 'grayscale opacity-80' : ''} bg-gray-200`}>
        {target.image_url ? (
          <Image
            src={target.image_url}
            alt={target.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            🏢
          </div>
        )}
        <div className="absolute left-3 top-3 max-w-[min(100%-1.5rem,14rem)] rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-gray-800 shadow-sm">
          <span className="block truncate" title={target.name}>
            {target.name}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mt-auto">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-bold text-gray-700">
              {target.current_amount.toLocaleString()} C
            </span>
            <span className="text-gray-400">{Math.round(progress)}%</span>
          </div>
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`progress-bar h-2 rounded-full ${
                isCompleted ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          {isCompleted ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-yellow-500 bg-yellow-500 py-2.5 text-sm font-bold text-white opacity-80">
              🏆 달성 완료
            </div>
          ) : (
            <DonationModal target={target} userPoints={userPoints} disabled={!canDonate}>
              <button
                type="button"
                disabled={!canDonate}
                className={`w-full rounded-xl border-2 py-2.5 text-sm font-bold transition active:scale-95 flex items-center justify-center gap-2 ${
                  canDonate
                    ? 'border-green-500 text-green-600 hover:bg-green-50'
                    : 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400'
                }`}
              >
                🤝 {canDonate ? '기부하기' : '포인트 부족'}
              </button>
            </DonationModal>
          )}
        </div>
      </div>
    </div>
  )
}
