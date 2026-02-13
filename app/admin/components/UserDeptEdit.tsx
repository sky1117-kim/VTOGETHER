'use client'

import { useState } from 'react'
import { updateUserDept } from '@/api/actions/admin'

interface UserDeptEditProps {
  userId: string
  initialDeptName: string | null
}

export function UserDeptEdit({ userId, initialDeptName }: UserDeptEditProps) {
  const [value, setValue] = useState(initialDeptName ?? '')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleSave() {
    setMessage(null)
    setPending(true)
    const result = await updateUserDept(userId, value.trim() || null)
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: '저장되었습니다.' })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="부서명"
          className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-800 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-lg bg-green-600 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? '저장 중' : '저장'}
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
