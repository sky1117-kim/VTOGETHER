'use client'

import { useEffect, useState } from 'react'
import type { AuctionEventStatus } from '@/api/actions/auction'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}일 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function AuctionCountdown({ startAt, endAt, status }: { startAt: string; endAt: string; status: AuctionEventStatus }) {
  const targetTime = status === 'UPCOMING' ? new Date(startAt).getTime() : new Date(endAt).getTime()
  const [remainingMs, setRemainingMs] = useState(() => targetTime - Date.now())

  useEffect(() => {
    if (status === 'CLOSED') return
    const timer = setInterval(() => setRemainingMs(targetTime - Date.now()), 1000)
    return () => clearInterval(timer)
  }, [targetTime, status])

  if (status === 'CLOSED') {
    return <span className="rounded-full bg-slate-500/90 px-3 py-1.5 text-[13px] font-black text-white">마감됨</span>
  }

  const urgent = status === 'ACTIVE' && remainingMs <= 24 * 60 * 60 * 1000
  const label = status === 'UPCOMING' ? '시작까지' : '마감까지'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-black tabular-nums text-white ${
        urgent ? 'bg-red-500/90 animate-pulse' : status === 'UPCOMING' ? 'bg-amber-500/90' : 'bg-emerald-500/90'
      }`}
    >
      {label} {formatRemaining(remainingMs)}
    </span>
  )
}
