'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createEvent } from '@/api/actions/admin/events'
import type { VerificationMethodInput } from '@/api/actions/admin/events'

const METHOD_TYPES: { value: VerificationMethodInput['method_type']; label: string }[] = [
  { value: 'PHOTO', label: '사진 업로드' },
  { value: 'TEXT', label: '텍스트 입력' },
  { value: 'VALUE', label: '숫자 입력' },
  { value: 'PEER_SELECT', label: '동료 선택 (칭찬 챌린지)' },
]

interface CreateEventFormProps {
  createdBy: string
}

export function CreateEventForm({ createdBy }: CreateEventFormProps) {
  const router = useRouter()
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'V_TOGETHER' | 'CULTURE'>('V_TOGETHER')
  const [type, setType] = useState<'ALWAYS' | 'SEASONAL'>('ALWAYS')
  const [rewardPolicy, setRewardPolicy] = useState<'SENDER_ONLY' | 'BOTH'>('SENDER_ONLY')
  const [rewardType, setRewardType] = useState<'POINTS' | 'COUPON' | 'CHOICE'>('POINTS')
  const [rewardAmount, setRewardAmount] = useState('100')
  const [selectedMethods, setSelectedMethods] = useState<VerificationMethodInput[]>([])

  const toggleMethod = (methodType: VerificationMethodInput['method_type']) => {
    setSelectedMethods((prev) => {
      const exists = prev.find((m) => m.method_type === methodType)
      if (exists) return prev.filter((m) => m.method_type !== methodType)
      return [...prev, { method_type: methodType, is_required: true }]
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!title.trim()) {
      setMessage({ type: 'error', text: '제목을 입력하세요.' })
      return
    }
    if (selectedMethods.length === 0) {
      setMessage({ type: 'error', text: '인증 방식을 1개 이상 선택하세요.' })
      return
    }
    const amount =
      rewardType === 'POINTS' && rewardAmount.trim()
        ? Math.max(0, parseInt(rewardAmount, 10) || 0)
        : null
    setPending(true)
    const result = await createEvent(
      {
        title: title.trim(),
        description: description.trim() || null,
        category,
        type,
        reward_policy: rewardPolicy,
        reward_type: rewardType,
        reward_amount: amount,
        status: 'ACTIVE',
        verification_methods: selectedMethods,
      },
      createdBy
    )
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: '이벤트가 등록되었습니다.' })
    router.push('/admin/events')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-gray-700">제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
          placeholder="예: 1월 걷기 챌린지"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700">설명</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
          placeholder="이벤트 안내 문구"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-bold text-gray-700">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as 'V_TOGETHER' | 'CULTURE')}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
          >
            <option value="V_TOGETHER">V.Together</option>
            <option value="CULTURE">Culture</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700">타입</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'ALWAYS' | 'SEASONAL')}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
          >
            <option value="ALWAYS">상시</option>
            <option value="SEASONAL">기간제</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-bold text-gray-700">보상 정책</label>
          <select
            value={rewardPolicy}
            onChange={(e) => setRewardPolicy(e.target.value as 'SENDER_ONLY' | 'BOTH')}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
          >
            <option value="SENDER_ONLY">참여자만 지급</option>
            <option value="BOTH">참여자 + 수신자 지급 (칭찬 챌린지)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700">보상 유형</label>
          <select
            value={rewardType}
            onChange={(e) => setRewardType(e.target.value as 'POINTS' | 'COUPON' | 'CHOICE')}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
          >
            <option value="POINTS">포인트</option>
            <option value="COUPON">쿠폰</option>
            <option value="CHOICE">선택 (포인트/쿠폰)</option>
          </select>
        </div>
      </div>

      {rewardType === 'POINTS' && (
        <div>
          <label className="block text-sm font-bold text-gray-700">보상 포인트 (P)</label>
          <input
            type="number"
            min={0}
            value={rewardAmount}
            onChange={(e) => setRewardAmount(e.target.value)}
            className="mt-1 w-32 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-gray-700">인증 방식 * (1개 이상 선택)</label>
        <div className="mt-2 flex flex-wrap gap-4">
          {METHOD_TYPES.map(({ value, label }) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selectedMethods.some((m) => m.method_type === value)}
                onChange={() => toggleMethod(value)}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? '등록 중…' : '이벤트 등록'}
        </button>
        <Link
          href="/admin/events"
          className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  )
}
