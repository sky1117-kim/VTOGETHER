'use client'
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateEventSafeFields, updateEventRewardAmounts } from '@/api/actions/admin/events'
import { uploadEventRepresentativeImage } from '@/api/actions/events'
import type { EventRow, EventRewardRow } from '@/api/actions/admin/events'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { formatIntegerWithCommas, sanitizeIntegerInput } from '@/lib/number-format'

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
  V_CREDIT: 'V.Credit (C)',
  V_MEDAL: 'V.Medal (M)',
  COFFEE_COUPON: '커피 쿠폰 (매수)',
  GOODS: '굿즈',
}

/** 수정 가능한 필드만 노출. 카테고리·인증 방식은 변경 시 데이터 깨질 수 있어 제외. 보상 금액은 수정 가능 */
interface EditEventFormProps {
  eventId: string
  event: Pick<EventRow, 'title' | 'description' | 'short_description' | 'image_url' | 'status' | 'category'>
  /** 이벤트 보상 목록. 정책 재화(V.Credit 또는 V.Medal) 수량만 수정 */
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
  const [imageUploading, setImageUploading] = useState(false)
  const [status, setStatus] = useState<EventRow['status']>(event.status)

  /** 대표 이미지 파일 업로드 후 URL 설정 */
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    setMessage(null)
    const fd = new FormData()
    fd.set('file', file)
    const result = await uploadEventRepresentativeImage(fd)
    setImageUploading(false)
    e.target.value = ''
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    if (result.url) setImageUrl(result.url)
  }

  const primaryRewardKind: EventRewardRow['reward_kind'] =
    event.category === 'PEOPLE' ? 'V_MEDAL' : 'V_CREDIT'
  const amountRewards = rewards.filter((r) => r.reward_kind === primaryRewardKind)
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
          글자 선택 후 툴바에서 굵게·기울임·목록·<strong>폰트 크기</strong>·<strong>색상</strong> 적용 가능. 이벤트 모달에도 동일하게 표시됩니다.
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
          대표 이미지 (선택)
        </label>
        <p className="mt-0.5 mb-1 text-xs text-gray-500">
          URL을 입력하거나 이미지 파일을 첨부하세요.
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            id="edit-image-url"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
            placeholder="https://..."
          />
          <label className="cursor-pointer rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageUpload}
              disabled={imageUploading}
              className="sr-only"
            />
            {imageUploading ? '업로드 중…' : '이미지 첨부'}
          </label>
        </div>
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
          <p className="mb-3 text-sm font-bold text-gray-700">
            보상 수량 ({event.category === 'PEOPLE' ? 'People -> V.Medal' : 'V.Together -> V.Credit'})
          </p>
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
                  type="text"
                  inputMode="numeric"
                  value={formatIntegerWithCommas(rewardAmounts[r.reward_id] ?? '')}
                  onChange={(e) =>
                    setRewardAmounts((prev) => ({
                      ...prev,
                      [r.reward_id]: parseInt(sanitizeIntegerInput(e.target.value), 10) || 0,
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
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50 btn-press"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}
