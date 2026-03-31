'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Bell, BellDot } from 'lucide-react'
import Link from 'next/link'
import type { NotificationItem } from '@/api/queries/user'
import { getEarnedDisplay } from '@/lib/point-display'

const STORAGE_KEY_PREFIX = 'point-notifications-read-'

function getLastReadAt(userId: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY_PREFIX + userId)
}

function setLastReadAt(userId: string, iso: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_PREFIX + userId, iso)
}

function getNotificationDate(n: NotificationItem): string {
  return n.created_at
}

// 알림 시간을 한국어 상대시간으로 표시하고, 오래된 항목은 날짜로 보여줍니다.
function formatRelativeTime(isoDate: string): string {
  const target = new Date(isoDate).getTime()
  if (Number.isNaN(target)) return ''

  const now = Date.now()
  const diffMs = now - target
  const diffSec = Math.max(0, Math.floor(diffMs / 1000))

  if (diffSec < 60) return '방금 전'
  if (diffSec < 60 * 60) return `${Math.floor(diffSec / 60)}분 전`
  if (diffSec < 60 * 60 * 24) return `${Math.floor(diffSec / (60 * 60))}시간 전`
  if (diffSec < 60 * 60 * 24 * 7) return `${Math.floor(diffSec / (60 * 60 * 24))}일 전`

  return new Date(isoDate).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  })
}

interface PointNotificationBellProps {
  userId: string
  notifications: NotificationItem[]
  /** dark: 어두운 배경(헤더)용 흰색 스타일 */
  variant?: 'default' | 'dark'
}

export function PointNotificationBell({ userId, notifications, variant = 'default' }: PointNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [lastReadAt, setLastReadAtState] = useState<string | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number; width?: number }>({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLastReadAtState(getLastReadAt(userId))
  }, [userId])

  const unreadCount = notifications.filter((n) => {
    const readAt = lastReadAt ? new Date(lastReadAt).getTime() : 0
    return new Date(getNotificationDate(n)).getTime() > readAt
  }).length
  const shouldKeepVisualHeight = notifications.length <= 1

  const handleOpen = () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    if (buttonRef.current) {
      const padding = 12
      const defaultPopupWidth = 336
      const cardEl = buttonRef.current.closest<HTMLElement>('[data-my-status-card]')
      if (cardEl && variant === 'dark') {
        const cardRect = cardEl.getBoundingClientRect()
        setPopupPosition({
          top: cardRect.top,
          left: cardRect.left,
          width: cardRect.width,
        })
      } else {
        const rect = buttonRef.current.getBoundingClientRect()
        const top = rect.bottom + 8
        let left = rect.right - defaultPopupWidth
        if (left < padding) left = padding
        if (left + defaultPopupWidth > window.innerWidth - padding) left = window.innerWidth - defaultPopupWidth - padding
        setPopupPosition({ top, left })
      }
    }
    setIsOpen(true)
  }

  // 팝업 닫을 때 읽음 처리 (열기만 하고 안 본 경우는 읽음 처리 안 함)
  const prevOpenRef = useRef(isOpen)
  useEffect(() => {
    if (prevOpenRef.current && !isOpen && notifications.length > 0) {
      const latest = getNotificationDate(notifications[0]!)
      const now = new Date().toISOString()
      const newReadAt = latest > now ? latest : now
      setLastReadAt(userId, newReadAt)
      setLastReadAtState(newReadAt)
    }
    prevOpenRef.current = isOpen
  }, [isOpen, notifications, userId])

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
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
          variant === 'dark'
            ? 'border border-white/40 bg-white/10 text-white hover:bg-white/20'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
        }`}
        aria-label={unreadCount > 0 ? `새 알림 ${unreadCount}건` : '적립 알림'}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.1} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* 알림 창: 포털 스타일로 가볍고 또렷한 드롭다운 */}
            <div
              ref={popupRef}
              className={`fixed z-[9999] max-h-[66vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_38px_rgba(2,6,23,0.16)] ${popupPosition.width == null ? 'w-[min(336px,calc(100vw-20px))]' : ''}`}
              style={{
                top: popupPosition.top,
                left: popupPosition.left,
                ...(popupPosition.width != null && { width: `${popupPosition.width}px` }),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더: 포털형 상단 바 */}
              <div className="border-b border-gray-100 bg-white px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-gray-900">
                    <BellDot className="h-4 w-4 text-blue-600" />
                    알림
                  </h3>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                      새 알림 {unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={`max-h-[calc(66vh-94px)] overflow-y-auto overflow-x-hidden bg-gray-50/70 p-1.5 [scrollbar-gutter:stable] ${
                  shouldKeepVisualHeight ? 'min-h-[220px]' : ''
                }`}
              >
                {notifications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">
                    최근 알림이 없어요.
                  </div>
                ) : (
                  <ul className="rounded-xl border border-gray-200 bg-white">
                    {notifications.map((n, idx) => {
                      const earned = getEarnedDisplay(n.description, { maxTextLength: 24 })
                      const isUnread = lastReadAt
                        ? new Date(getNotificationDate(n)).getTime() > new Date(lastReadAt).getTime()
                        : true
                      return (
                        <li key={n.transaction_id}>
                          <Link
                            href={`/my?highlight=${n.transaction_id}#point-history`}
                            onClick={() => setIsOpen(false)}
                            className={`block px-3 py-2.5 transition ${
                              isUnread
                                ? 'bg-blue-50/70 hover:bg-blue-100/80'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {/* 안 읽은 항목은 제목 앞 점으로 빠르게 구분 */}
                                  {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />}
                                  <p className="truncate text-sm font-semibold text-gray-800 leading-snug">
                                    {earned.text}
                                  </p>
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600">
                                +{n.amount.toLocaleString()} {n.currency_type === 'V_MEDAL' ? 'M' : 'C'}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                {earned.badge && (
                                  <span
                                    className={`inline-block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      earned.variant === 'received'
                                        ? 'bg-violet-100 text-violet-700'
                                        : earned.variant === 'gave'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-green-100 text-green-700'
                                    }`}
                                  >
                                    {earned.badge}
                                  </span>
                                )}
                              </div>
                              <p className="shrink-0 text-[11px] text-gray-500">
                                {formatRelativeTime(n.created_at)}
                              </p>
                            </div>
                          </Link>
                          {idx < notifications.length - 1 && <div className="mx-3 h-px bg-gray-200" aria-hidden />}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              <div className="border-t border-gray-100 bg-white px-2.5 py-2">
                <Link
                  href="/my"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-lg bg-[#00b859] py-2 text-center text-sm font-semibold text-white transition hover:bg-[#009e4d]"
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
