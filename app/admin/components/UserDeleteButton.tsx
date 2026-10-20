'use client'

import { useState } from 'react'
import { deleteUserAccountByAdmin } from '@/api/actions/admin'
import { useFeedback } from '@/components/ui/feedback'

interface UserDeleteButtonProps {
  userId: string
  userEmail: string
  userName: string | null
}

export function UserDeleteButton({ userId, userEmail, userName }: UserDeleteButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { confirm, toast } = useFeedback()

  async function handleDelete() {
    // 실수 삭제를 줄이기 위해 이메일 확인 문구를 띄웁니다.
    const ok = await confirm({
      title: '계정 삭제',
      message: `정말 이 계정을 삭제할까요?\n\n대상: ${userName || userEmail}\n${userEmail}\n\n삭제 후에는 목록에서 숨겨지고 로그인도 차단됩니다.`,
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return

    setPending(true)
    setError(null)
    const result = await deleteUserAccountByAdmin(userId)
    setPending(false)
    if (result.error) {
      setError(result.error)
      toast(result.error, 'error')
      return
    }
    toast(`${userName || userEmail} 계정을 삭제했습니다.`)
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '삭제 중...' : '계정 삭제'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
