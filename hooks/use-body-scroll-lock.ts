'use client'

import { useEffect } from 'react'

/** 모달이 열려 있을 때 body 스크롤을 막고, 닫을 때 복원합니다. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}
