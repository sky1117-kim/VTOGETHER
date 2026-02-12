'use client'

import { useState } from 'react'
import { grantPoints } from '@/api/actions/admin'
import type { UserRow } from '@/api/actions/admin'

interface GrantPointsFormProps {
  users: UserRow[]
}

export function GrantPointsForm({ users }: GrantPointsFormProps) {
  const [userId, setUserId] = useState(users[0]?.user_id ?? '')
  const [amount, setAmount] = useState('1000')
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const num = parseInt(amount, 10)
    if (Number.isNaN(num) || num < 1) {
      setMessage({ type: 'error', text: '1 이상의 숫자를 입력해주세요.' })
      return
    }
    setPending(true)
    const result = await grantPoints(userId, num)
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: `${num.toLocaleString()}P 지급 완료되었습니다.` })
    setAmount('1000')
  }

  /** 테스트용: 선택한 사용자에게 5만 P 한 번에 지급 */
  async function handleGrant50k() {
    setMessage(null)
    setPending(true)
    const result = await grantPoints(userId, 50000)
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: '50,000P 지급 완료. 메인에서 기부 테스트해보세요.' })
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        사용자가 없습니다. 메인에서 Google로 로그인한 뒤 다시 확인해주세요.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-bold text-gray-700">대상 사용자</label>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.name || u.email} ({u.email}) — {u.current_points.toLocaleString()}P 보유
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-bold text-gray-700">지급 포인트 (P)</label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      {message && (
        <p
          className={`text-sm font-medium ${
            message.type === 'ok' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? '처리 중…' : '포인트 지급'}
        </button>
        <button
          type="button"
          onClick={handleGrant50k}
          disabled={pending}
          className="shrink-0 rounded-xl border-2 border-green-600 bg-white px-4 py-3 font-bold text-green-600 transition hover:bg-green-50 disabled:opacity-50"
        >
          테스트용 5만 P
        </button>
      </div>
    </form>
  )
}
