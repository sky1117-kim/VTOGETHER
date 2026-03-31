'use client'

import { useState } from 'react'
import { updateDonationTargetAmount } from '@/api/actions/admin/donation-targets'
import { formatIntegerWithCommas, sanitizeIntegerInput } from '@/lib/number-format'

interface TargetAmountEditProps {
  targetId: string
  targetName: string
  currentTargetAmount: number
}

export function TargetAmountEdit({ targetId, targetName, currentTargetAmount }: TargetAmountEditProps) {
  void targetName
  const [value, setValue] = useState(String(currentTargetAmount))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleSave() {
    setMessage(null)
    const num = parseInt(sanitizeIntegerInput(value), 10)
    if (Number.isNaN(num) || num < 0) {
      setMessage({ type: 'error', text: '0 이상의 숫자를 입력하세요.' })
      return
    }
    setPending(true)
    const result = await updateDonationTargetAmount(targetId, num)
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: '목표 금액이 수정되었습니다.' })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={formatIntegerWithCommas(value)}
          onChange={(e) => setValue(sanitizeIntegerInput(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="10,000,000"
          className="w-32 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-800 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-lg bg-green-600 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? '저장 중' : '수정'}
        </button>
      </div>
      {message && (
        <p className={`text-xs ${message.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
