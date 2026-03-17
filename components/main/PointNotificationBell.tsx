'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'
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
  return n.type === 'PENDING_REWARD' || n.type === 'PENDING_RECIPIENT_REWARD'
    ? n.reviewed_at
    : n.created_at
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

  const handleOpen = () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    if (buttonRef.current) {
      const padding = 12
      const defaultPopupWidth = 400
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
              className={`fixed z-[9999] min-h-[280px] max-h-[70vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl ${popupPosition.width == null ? 'w-[min(400px,calc(100vw-24px))]' : ''}`}
              style={{
                top: popupPosition.top,
                left: popupPosition.left,
                ...(popupPosition.width != null && { width: `${popupPosition.width}px` }),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더·본문·푸터 좌우 패딩 통일 (px-4)로 선 정렬 */}
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-4">
                <h3 className="text-base font-bold text-gray-900">알림</h3>
              </div>
              <div className="max-h-[calc(70vh-120px)] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-gray-500">
                    최근 알림이 없습니다.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {notifications.map((n) => {
                      if (n.type === 'PENDING_REWARD') {
                        const roundText = n.round_number != null ? ` ${n.round_number}구간` : ''
                        const fullTitle = n.event_title + roundText
                        const title = fullTitle.length > 24 ? fullTitle.slice(0, 24) + '…' : fullTitle
                        return (
                          <li key={`pending-${n.submission_id}`}>
                            <Link
                              href="/#events"
                              onClick={() => setIsOpen(false)}
                              className="block px-4 py-4 transition hover:bg-amber-50"
                            >
                              <span className="mb-1.5 block w-fit rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                보상 선택 대기
                              </span>
                              <p className="truncate text-base font-medium text-gray-800 leading-snug">
                                {title}
                              </p>
                              <p className="mt-1 text-sm text-gray-500">
                                {new Date(n.reviewed_at).toLocaleDateString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </Link>
                          </li>
                        )
                      }
                      if (n.type === 'PENDING_RECIPIENT_REWARD') {
                        const roundText = n.round_number != null ? ` ${n.round_number}구간` : ''
                        const fullTitle = n.event_title + roundText
                        const title = fullTitle.length > 24 ? fullTitle.slice(0, 24) + '…' : fullTitle
                        return (
                          <li key={`recipient-${n.submission_id}`}>
                            <Link
                              href="/my#point-history"
                              onClick={() => setIsOpen(false)}
                              className="block px-4 py-4 transition hover:bg-violet-50"
                            >
                              <span className="mb-1.5 block w-fit rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                                칭찬 승인됨
                              </span>
                              <p className="truncate text-base font-medium text-gray-800 leading-snug">
                                {title} · 보상 선택 시 지급
                              </p>
                              <p className="mt-1 text-sm text-gray-500">
                                {new Date(n.reviewed_at).toLocaleDateString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </Link>
                          </li>
                        )
                      }
                      const earned = getEarnedDisplay(n.description, { maxTextLength: 24 })
                      return (
                        <li key={n.transaction_id}>
                          <Link
                            href={`/my?highlight=${n.transaction_id}#point-history`}
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-4 transition hover:bg-gray-50"
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="min-w-0 flex-1 truncate text-base font-medium text-gray-800 leading-snug">
                                {earned.text}
                              </p>
                              <span className="shrink-0 text-base font-bold text-green-600">
                                +{n.amount.toLocaleString()} P
                              </span>
                            </div>
                            {earned.badge && (
                              <span
                                className={`mt-1.5 block w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${
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
                            <p className="mt-1 text-sm text-gray-500">
                              {new Date(n.created_at).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-4">
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
