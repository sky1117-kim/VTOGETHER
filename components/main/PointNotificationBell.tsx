'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import type { PointNotificationRow } from '@/api/queries/user'

const STORAGE_KEY_PREFIX = 'point-notifications-read-'

function getLastReadAt(userId: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY_PREFIX + userId)
}

function setLastReadAt(userId: string, iso: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_PREFIX + userId, iso)
}

interface PointNotificationBellProps {
  userId: string
  notifications: PointNotificationRow[]
  /** dark: 어두운 배경(헤더)용 흰색 스타일 */
  variant?: 'default' | 'dark'
}

export function PointNotificationBell({ userId, notifications, variant = 'default' }: PointNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [lastReadAt, setLastReadAtState] = useState<string | null>(null)
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLastReadAtState(getLastReadAt(userId))
  }, [userId])

  const unreadCount = notifications.filter((n) => {
    const readAt = lastReadAt ? new Date(lastReadAt).getTime() : 0
    return new Date(n.created_at).getTime() > readAt
  }).length

  const handleOpen = () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const padding = 12
      const popupWidth = 400
      // 벨 아이콘 바로 아래에 배치
      const top = rect.bottom + 8
      let left = rect.right - popupWidth
      if (left < padding) left = padding
      if (left + popupWidth > window.innerWidth - padding) left = window.innerWidth - popupWidth - padding
      setPopupPosition({ top, left })
    }
    setIsOpen(true)
    if (notifications.length > 0) {
      const latest = notifications[0]!.created_at
      const now = new Date().toISOString()
      const newReadAt = latest > now ? latest : now
      setLastReadAt(userId, newReadAt)
      setLastReadAtState(newReadAt)
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (!isOpen) return
      const inButton = ref.current?.contains(target)
      const inPopup = popupRef.current?.contains(target)
      if (!inButton && !inPopup) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`relative rounded-lg p-2 transition ${
          variant === 'dark'
            ? 'border border-white/40 bg-white/10 text-white hover:bg-white/20'
            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
        aria-label={unreadCount > 0 ? `새 알림 ${unreadCount}건` : '적립 알림'}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
            {unreadCount > 99 ? '99' : unreadCount}
          </span>
        )}
      </button>
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* 알림 창: 그림자로 자연스럽게 구분 */}
            <div
              ref={popupRef}
              className="fixed z-[9999] w-[min(400px,calc(100vw-24px))] min-h-[280px] max-h-[70vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
              style={{ top: popupPosition.top, left: popupPosition.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
                <h3 className="text-base font-bold text-gray-900">최근 1주일 적립 내역</h3>
              </div>
              <div className="max-h-[calc(70vh-120px)] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-5 py-10 text-center text-gray-500">
                    최근 적립 내역이 없습니다.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {notifications.map((n) => (
                      <li key={n.transaction_id} className="px-5 py-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-base font-medium text-gray-800 leading-snug">
                            {n.description?.trim() || '적립'}
                          </p>
                          <span className="shrink-0 text-lg font-bold text-green-600">
                            +{n.amount.toLocaleString()} P
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {new Date(n.created_at).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-gray-200 bg-gray-50 px-5 py-4">
                <Link
                  href="/my"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-xl bg-green-600 py-3 text-center text-sm font-bold text-white transition hover:bg-green-700"
                >
                  전체 내역 보기
                </Link>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  )
}
