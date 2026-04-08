'use client'

import { useState } from 'react'
import { deleteMyAccount } from '@/api/actions/auth'

export function MyAccountDeleteButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    // 탈퇴는 되돌릴 수 없으므로 사용자에게 한 번 더 확인받습니다.
    const ok = confirm(
      '정말 계정을 삭제할까요?\n\n삭제 후에는 이 계정으로 로그인해도 서비스 데이터에 접근할 수 없습니다.'
    )
    if (!ok) return

    setPending(true)
    setError(null)
    try {
      await deleteMyAccount()
    } catch (e) {
      setPending(false)
      setError(e instanceof Error ? e.message : '계정 삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/40 p-4">
      <p className="text-sm font-semibold text-slate-800">계정 삭제</p>
      <p className="mt-1 text-xs text-slate-600">
        테스트 계정 정리 또는 퇴사 전 계정 정리에 사용합니다. 삭제 후 복구가 어려울 수 있습니다.
      </p>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="mt-3 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '삭제 중...' : '내 계정 삭제하기'}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
