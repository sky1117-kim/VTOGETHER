'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { fetchMentionableUsers } from '@/api/actions/notices'

type User = { user_id: string; name: string; dept_name: string | null }

interface MentionInputProps {
  value: string
  onChange: (val: string) => void
  onSubmit: (e: React.FormEvent) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  children?: React.ReactNode // submit button slot
}

export function MentionInput({ value, onChange, onSubmit, placeholder, disabled, className, children }: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<User[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(async (q: string) => {
    if (!q && q !== '') return
    const users = await fetchMentionableUsers(q)
    setSuggestions(users)
    setShowDropdown(users.length > 0)
    setActiveIdx(0)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)

    const cursor = e.target.selectionStart ?? val.length
    // @뒤 텍스트 추출
    const textBeforeCursor = val.slice(0, cursor)
    const atMatch = textBeforeCursor.match(/@([^@\s]*)$/)

    if (atMatch) {
      const q = atMatch[1]
      setMentionQuery(q)
      setMentionStart(cursor - atMatch[0].length)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchUsers(q), 150)
    } else {
      setShowDropdown(false)
      setMentionStart(-1)
    }
  }

  function selectUser(user: User) {
    const cursor = inputRef.current?.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(cursor)
    const inserted = `@${user.name} `
    onChange(before + inserted + after)
    setShowDropdown(false)
    setMentionStart(-1)
    setTimeout(() => {
      const pos = before.length + inserted.length
      inputRef.current?.setSelectionRange(pos, pos)
      inputRef.current?.focus()
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && showDropdown) { e.preventDefault(); selectUser(suggestions[activeIdx]) }
    if (e.key === 'Escape') { setShowDropdown(false) }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <form onSubmit={onSubmit} className="relative flex items-center">
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          maxLength={500}
        />

        {/* 멘션 드롭다운 */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full left-0 z-50 mb-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              멤버 태그하기
            </div>
            {suggestions.map((user, i) => (
              <button
                key={user.user_id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectUser(user) }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${i === activeIdx ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-xs font-bold text-white">
                  {user.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                  {user.dept_name && <p className="truncate text-[10px] text-slate-400">{user.dept_name}</p>}
                </div>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-emerald-500">@{user.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {children}
    </form>
  )
}

/** 댓글 텍스트에서 @멘션을 하이라이트하는 유틸 */
export function renderWithMentions(text: string) {
  const parts = text.split(/(@[가-힣\w]+)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-bold text-emerald-600">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}
