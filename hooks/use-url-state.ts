'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * 필터·검색어처럼 화면 상태를 주소(?key=value)에 함께 저장합니다.
 * 새로고침하거나 뒤로 가기로 돌아와도 같은 조건이 유지되고, 주소를 공유하면 같은 화면이 열립니다.
 * 서버 재요청 없이 history.replaceState로만 갱신합니다.
 */
export function useUrlState<T extends string>(key: string, defaultValue: T): [T, (value: T) => void] {
  const searchParams = useSearchParams()
  const [value, setValue] = useState<T>(() => (searchParams.get(key) as T | null) ?? defaultValue)

  const update = useCallback(
    (next: T) => {
      setValue(next)
      const params = new URLSearchParams(window.location.search)
      if (next === defaultValue || next === '') params.delete(key)
      else params.set(key, next)
      const qs = params.toString()
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    },
    [key, defaultValue]
  )

  return [value, update]
}
