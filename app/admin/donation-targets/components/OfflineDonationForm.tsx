'use client'

import { useState } from 'react'
import { addOfflineDonation } from '@/api/actions/admin/donation-targets'

interface OfflineDonationFormProps {
  targetId: string
  targetName: string
}

export function OfflineDonationForm({ targetId, targetName }: OfflineDonationFormProps) {
  const [amount, setAmount] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const num = parseInt(amount.replace(/,/g, ''), 10)
    if (Number.isNaN(num) || num < 1) {
      setMessage({ type: 'error', text: '1 이상의 금액을 입력하세요.' })
      return
    }
    setPending(true)
    const result = await addOfflineDonation(targetId, num)
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: `${num.toLocaleString()}P 오프라인 합산 반영되었습니다.` })
    setAmount('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
          placeholder="금액"
          className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-800 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <button
          type="submit"
          disabled={pending || !amount.trim()}
          className="rounded-lg bg-amber-600 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
        >
          {pending ? '반영 중' : '합산'}
        </button>
      </div>
      {message && (
        <p className={`text-xs ${message.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </form>
  )
}
