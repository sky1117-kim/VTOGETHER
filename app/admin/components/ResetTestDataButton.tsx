'use client'

import { useState } from 'react'
import { resetAndSeedTestData } from '@/api/actions/admin'

export function ResetTestDataButton() {
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function handleClick() {
    if (!confirm('기존 포인트/기부 데이터를 모두 초기화하고 테스트 데이터로 채우시겠습니까?')) return
    setMessage(null)
    setPending(true)
    const result = await resetAndSeedTestData()
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: '테스트 데이터로 초기화되었습니다. 메인/기부/랭킹 화면을 새로고침해보세요.' })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 btn-press"
      >
        {pending ? '처리 중…' : '테스트 데이터 초기화'}
      </button>
      {message && (
        <p className={`text-sm ${message.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
