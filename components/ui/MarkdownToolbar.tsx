'use client'

import { useRef, useCallback, type KeyboardEvent } from 'react'

type ToolbarAction = {
  label: string
  icon: string
  title: string
  shortcut?: string
  /** 선택 영역을 앞뒤로 감쌈. 없으면 줄 시작에 삽입 */
  wrap?: [string, string]
  /** 줄 시작에 삽입 (불릿 등) */
  linePrefix?: string
}

const ACTIONS: ToolbarAction[] = [
  { label: '굵게', icon: 'B', title: '굵게 (⌘B)', shortcut: 'b', wrap: ['**', '**'] },
  { label: '기울임', icon: 'I', title: '기울임 (⌘I)', shortcut: 'i', wrap: ['*', '*'] },
  { label: '불릿', icon: '•', title: '불릿 목록', linePrefix: '- ' },
  { label: '숫자', icon: '1.', title: '숫자 목록', linePrefix: '1. ' },
  { label: '링크', icon: '🔗', title: '링크', wrap: ['[', '](url)'] },
]

interface MarkdownToolbarProps {
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  rows?: number
  className?: string
  'aria-label'?: string
}

/** 텍스트 영역에 마크다운 툴바 + ⌘B/⌘I 단축키 적용 */
export function MarkdownToolbar({
  value,
  onChange,
  id,
  placeholder,
  rows = 10,
  className = '',
  'aria-label': ariaLabel,
}: MarkdownToolbarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const getSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el) return { start: 0, end: 0, text: '' }
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = value
    return { start, end, text }
  }, [value])

  const applyWrap = useCallback(
    (before: string, after: string) => {
      const { start, end, text } = getSelection()
      const selected = text.slice(start, end)
      const next = text.slice(0, start) + before + selected + after + text.slice(end)
      onChange(next)
      setTimeout(() => {
        textareaRef.current?.focus()
        const newStart = start + before.length
        const newEnd = newStart + selected.length
        textareaRef.current?.setSelectionRange(newStart, newEnd)
      }, 0)
    },
    [getSelection, onChange]
  )

  const applyLinePrefix = useCallback(
    (prefix: string) => {
      const { start, text } = getSelection()
      const lines = text.split('\n')
      let offset = 0
      let lineIndex = 0
      for (let i = 0; i < lines.length; i++) {
        const lineLen = lines[i].length + (i < lines.length - 1 ? 1 : 0)
        if (offset + lineLen > start) {
          lineIndex = i
          break
        }
        offset += lineLen
      }
      if (lines[lineIndex].startsWith(prefix)) return
      lines[lineIndex] = prefix + lines[lineIndex]
      onChange(lines.join('\n'))
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [getSelection, onChange]
  )

  const handleToolbarClick = useCallback(
    (action: ToolbarAction) => {
      if (action.wrap) {
        applyWrap(action.wrap[0], action.wrap[1])
      } else if (action.linePrefix) {
        applyLinePrefix(action.linePrefix)
      }
    },
    [applyWrap, applyLinePrefix]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const action = ACTIONS.find((a) => a.shortcut && a.shortcut === e.key.toLowerCase())
      if (action) {
        e.preventDefault()
        if (action.wrap) applyWrap(action.wrap[0], action.wrap[1])
        if (action.linePrefix) applyLinePrefix(action.linePrefix)
      }
    },
    [applyWrap, applyLinePrefix]
  )

  return (
    <div className="rounded-lg border border-gray-300 overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.title}
            onClick={() => handleToolbarClick(action)}
            className="flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-sm font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          >
            {action.icon}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-400">⌘B 굵게 · ⌘I 기울임</span>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className={`w-full resize-y border-0 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-0 ${className}`}
        aria-label={ariaLabel}
      />
    </div>
  )
}
