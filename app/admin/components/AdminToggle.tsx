'use client'

import { useState } from 'react'
import { updateUserAdmin } from '@/api/actions/admin'

interface AdminToggleProps {
  userId: string
  initial: boolean
  /** 본인 계정이면 체크 해제 시 접근 불가 안내 */
  isSelf?: boolean
}

export function AdminToggle({ userId, initial, isSelf }: AdminToggleProps) {
  const [checked, setChecked] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked
    if (isSelf && !next) {
      if (!confirm('본인 관리자 권한을 해제하면 이 페이지에 다시 접근할 수 없습니다. 계속할까요?')) {
        return
      }
    }
    setError(null)
    setPending(true)
    const result = await updateUserAdmin(userId, next)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setChecked(next)
  }

  return (
    <div className="flex flex-col gap-0.5">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={pending}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
        />
        <span className="text-sm font-medium text-gray-700">관리자</span>
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
