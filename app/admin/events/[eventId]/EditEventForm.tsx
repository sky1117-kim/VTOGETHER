'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateEventSafeFields, updateEventRewardAmounts } from '@/api/actions/admin/events'
import type { EventRow, EventRewardRow } from '@/api/actions/admin/events'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500'
const inputNumberClass = inputClass + ' w-32'
const labelClass = 'block text-sm font-bold text-gray-700'

const STATUS_OPTIONS: { value: EventRow['status']; label: string }[] = [
  { value: 'ACTIVE', label: '진행 중' },
  { value: 'PAUSED', label: '일시정지' },
  { value: 'ENDED', label: '종료' },
]

const REWARD_KIND_LABEL: Record<EventRewardRow['reward_kind'], string> = {
  V_POINT: 'V.Point (P)',
  COFFEE_COUPON: '커피 쿠폰 (매수)',
  GOODS: '굿즈',
}

/** 수정 가능한 필드만 노출. 카테고리·인증 방식은 변경 시 데이터 깨질 수 있어 제외. 보상 금액은 수정 가능 */
interface EditEventFormProps {
  eventId: string
  event: Pick<EventRow, 'title' | 'description' | 'short_description' | 'image_url' | 'status'>
  /** 이벤트 보상 목록. V.Point·커피쿠폰 금액 수정 가능 (이미 지급된 건 기존 금액, 이후부터 새 금액 적용) */
  rewards?: EventRewardRow[]
}

export function EditEventForm({ eventId, event, rewards = [] }: EditEventFormProps) {
  const router = useRouter()
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description ?? '')
  const [shortDescription, setShortDescription] = useState(event.short_description ?? '')
  const [imageUrl, setImageUrl] = useState(event.image_url ?? '')
  const [status, setStatus] = useState<EventRow['status']>(event.status)

  const amountRewards = rewards.filter((r) => r.reward_kind === 'V_POINT' || r.reward_kind === 'COFFEE_COUPON')
  const [rewardAmounts, setRewardAmounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const r of amountRewards) {
      init[r.reward_id] = r.amount ?? 0
    }
    return init
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setPending(true)
    try {
      const { success, error } = await updateEventSafeFields(eventId, {
        title: title.trim(),
        description: description.trim() || null,
        short_description: shortDescription.trim() || null,
        image_url: imageUrl.trim() || null,
        status,
      })
      if (!success) {
        setMessage({ type: 'error', text: error ?? '저장에 실패했습니다.' })
        return
      }
      if (amountRewards.length > 0) {
        const updates = amountRewards.map((r) => ({
          reward_id: r.reward_id,
          amount: Math.max(0, rewardAmounts[r.reward_id] ?? r.amount ?? 0),
        }))
        const { success: ok2, error: err2 } = await updateEventRewardAmounts(eventId, updates)
        if (!ok2) {
          setMessage({ type: 'error', text: err2 ?? '보상 금액 저장에 실패했습니다.' })
          return
        }
      }
      setMessage({ type: 'ok', text: '저장했습니다.' })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            message.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label htmlFor="edit-title" className={labelClass}>
          제목
        </label>
        <input
          id="edit-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor="edit-short-description" className={labelClass}>
          짧은 소개 (목록/카드용)
        </label>
        <input
          id="edit-short-description"
          type="text"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          className={inputClass}
          placeholder="한 줄 요약"
        />
      </div>

      <div>
        <label htmlFor="edit-description" className={labelClass}>
          상세 소개문구
        </label>
        <p className="mt-0.5 mb-1 text-xs text-gray-500">
          글자 선택 후 ⌘B(굵게)·⌘I(기울임) 또는 툴바 버튼 — 입력창에서 바로 반영됩니다
        </p>
        <RichTextEditor
          id="edit-description"
          value={description}
          onChange={setDescription}
          placeholder="이벤트 상세 설명"
          aria-label="상세 소개문구"
        />
      </div>

      <div>
        <label htmlFor="edit-image-url" className={labelClass}>
          대표 이미지 URL (선택)
        </label>
        <input
          id="edit-image-url"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className={inputClass}
          placeholder="https://..."
        />
        {imageUrl.trim() && (
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <img
              src={imageUrl}
              alt="대표 이미지 미리보기"
              className="max-h-40 w-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="edit-status" className={labelClass}>
          상태
        </label>
        <select
          id="edit-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as EventRow['status'])}
          className={inputClass}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {amountRewards.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <p className="mb-3 text-sm font-bold text-gray-700">보상 금액 (V.Point · 커피 쿠폰)</p>
          <p className="mb-3 text-xs text-gray-500">
            이미 지급된 보상은 기존 금액 그대로이며, 이후 인증 통과분부터 새 금액이 적용됩니다.
          </p>
          <div className="flex flex-wrap gap-4">
            {amountRewards.map((r) => (
              <div key={r.reward_id}>
                <label htmlFor={`reward-${r.reward_id}`} className={labelClass}>
                  {REWARD_KIND_LABEL[r.reward_kind]}
                </label>
                <input
                  id={`reward-${r.reward_id}`}
                  type="number"
                  min={0}
                  value={rewardAmounts[r.reward_id] ?? ''}
                  onChange={(e) =>
                    setRewardAmounts((prev) => ({
                      ...prev,
                      [r.reward_id]: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className={inputNumberClass}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}
