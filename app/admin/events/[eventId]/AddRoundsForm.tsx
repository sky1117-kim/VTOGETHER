'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoundsForMonth } from '@/api/actions/admin/events'

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500'

interface AddRoundsFormProps {
  eventId: string
}

export function AddRoundsForm({ eventId }: AddRoundsFormProps) {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setPending(true)
    const result = await createRoundsForMonth(eventId, year, month)
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: `${year}년 ${month}월 3구간이 추가되었습니다.` })
    router.refresh()
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            message.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}
      <p className="text-sm text-gray-600">
        1구간 1~10일(인증 15일), 2구간 11~20일(인증 25일), 3구간 21~말일(인증 익월 5일)
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">연도</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={inputClass}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">월</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={inputClass}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? '추가 중…' : '해당 월 3구간 자동 생성'}
        </button>
      </div>
    </form>
  )
}
