'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { FontSize, FONT_SIZE_OPTIONS, type FontSizeValue } from '@/lib/tiptap/fontSize'
import { TextColor, TEXT_COLOR_OPTIONS } from '@/lib/tiptap/textColor'
import { Highlight, HIGHLIGHT_OPTIONS } from '@/lib/tiptap/highlight'

/** #hex 형식인지 확인 */
function isHexColor(s: string): boolean {
  return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(s)
}

const EDITOR_CLASS =
  'rte-content min-h-[240px] w-full break-keep px-3 py-2 text-base leading-normal text-gray-900 outline-none [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:leading-normal [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:leading-normal [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0'

/** HTML을 저장. 굵게/기울임/목록·폰트 크기·색상 지원 WYSIWYG */
interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  id?: string
  placeholder?: string
  'aria-label'?: string
}

function isEmptyHtml(html: string): boolean {
  const s = html.replace(/<[^>]+>/g, '').trim()
  return !s
}

export function RichTextEditor({
  value,
  onChange,
  id,
  placeholder = '내용을 입력하세요',
  'aria-label': ariaLabel,
}: RichTextEditorProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      FontSize,
      TextColor,
      Highlight,
    ],
    content: value?.trim() ? value : '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel ?? '본문',
        id: inputId,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(isEmptyHtml(html) ? '' : html)
      // 커스텀 hex(data-color="#...", data-bg-color="#...") 인라인 스타일로 적용해 글자 제대로 보이게
      const dom = editor.view.dom
      dom.querySelectorAll<HTMLElement>('span[data-color^="#"]').forEach((el) => {
        const c = el.getAttribute('data-color')
        if (c) el.style.color = c
      })
      dom.querySelectorAll<HTMLElement>('span[data-bg-color^="#"]').forEach((el) => {
        const c = el.getAttribute('data-bg-color')
        if (c) el.style.backgroundColor = c
      })
    },
  })

  // 부모에서 value가 바뀌었을 때(예: 다른 이벤트 선택) 에디터 내용 동기화
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value?.trim() ? value : '<p></p>'
    if (current !== next) editor.commands.setContent(next, { emitUpdate: false })
  }, [editor, value])

  // 로드된 HTML에 커스텀 hex가 있으면 인라인 스타일 적용 (DOM 반영 후 실행)
  const editorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const apply = () => {
      const root = editorRef.current
      if (!root) return
      root.querySelectorAll<HTMLElement>('span[data-color^="#"]').forEach((el) => {
        const c = el.getAttribute('data-color')
        if (c) el.style.color = c
      })
      root.querySelectorAll<HTMLElement>('span[data-bg-color^="#"]').forEach((el) => {
        const c = el.getAttribute('data-bg-color')
        if (c) el.style.backgroundColor = c
      })
    }
    const t = setTimeout(apply, 0)
    return () => clearTimeout(t)
  }, [value])

  const [fontSizeOpen, setFontSizeOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)
  const [colorHex, setColorHex] = useState('')
  const [bgHex, setBgHex] = useState('')

  if (!editor) return null

  const currentSize = (editor.getAttributes('fontSize').size as FontSizeValue) || 'normal'
  const currentColor = (editor.getAttributes('textColor').color as string) || 'black'
  const currentBg = (editor.getAttributes('highlight').bgColor as string) || 'none'

  return (
    <div className="rounded-lg border border-gray-300 overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <button
          type="button"
          title="굵게 (⌘B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-sm font-bold text-gray-600 hover:bg-gray-200 hover:text-gray-900 ${editor.isActive('bold') ? 'bg-gray-200 text-gray-900' : ''}`}
        >
          B
        </button>
        <button
          type="button"
          title="기울임 (⌘I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-sm italic text-gray-600 hover:bg-gray-200 hover:text-gray-900 ${editor.isActive('italic') ? 'bg-gray-200 text-gray-900' : ''}`}
        >
          I
        </button>
        <button
          type="button"
          title="불릿 목록"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-sm text-gray-600 hover:bg-gray-200 hover:text-gray-900 ${editor.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : ''}`}
        >
          •
        </button>
        <button
          type="button"
          title="숫자 목록"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-sm text-gray-600 hover:bg-gray-200 hover:text-gray-900 ${editor.isActive('orderedList') ? 'bg-gray-200 text-gray-900' : ''}`}
        >
          1.
        </button>
        <div className="relative ml-1 flex items-center gap-0.5">
          <button
            type="button"
            title="폰트 크기 (글자 선택 후 적용)"
            onClick={() => { setFontSizeOpen((o) => !o); setColorOpen(false) }}
            className="flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-sm font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          >
            Aa
          </button>
          <span className="text-xs text-gray-400">크기</span>
          {fontSizeOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFontSizeOpen(false)} aria-hidden />
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {FONT_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (opt.value === 'normal') {
                        editor.chain().focus().unsetMark('fontSize').run()
                      } else {
                        editor.chain().focus().setMark('fontSize', { size: opt.value }).run()
                      }
                      setFontSizeOpen(false)
                    }}
                    className={`block w-full px-3 py-1.5 text-left hover:bg-gray-100 ${currentSize === opt.value ? 'bg-gray-100 font-medium' : ''} ${opt.value === 'small' ? 'text-xs' : opt.value === 'large' ? 'text-lg' : 'text-sm'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="relative flex items-center gap-0.5">
          <button
            type="button"
            title="글자 색상 (글자 선택 후 적용)"
            onClick={() => { setColorOpen((o) => !o); setFontSizeOpen(false); setHighlightOpen(false) }}
            className="flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-sm text-gray-700 hover:bg-gray-200 hover:text-gray-900"
          >
            <span className="inline-block h-4 w-4 rounded border-2 border-gray-500 bg-gray-900" aria-hidden title="글자 색상" />
          </button>
          <span className="text-xs text-gray-500">색상</span>
          {colorOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setColorOpen(false); setColorHex('') }} aria-hidden />
              <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                <div className="mb-2 grid grid-cols-2 gap-1">
                  {TEXT_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (opt.value === 'black') {
                          editor.chain().focus().unsetMark('textColor').run()
                        } else {
                          editor.chain().focus().setMark('textColor', { color: opt.value }).run()
                        }
                        setColorOpen(false)
                      }}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100 ${currentColor === opt.value ? 'bg-gray-100 font-semibold text-gray-900' : ''}`}
                    >
                      <span
                        className={`h-3 w-3 shrink-0 rounded-full border border-gray-300 ${
                          opt.value === 'black' ? 'bg-gray-900' : opt.value === 'gray' ? 'bg-gray-500' : opt.value === 'red' ? 'bg-red-500' : opt.value === 'orange' ? 'bg-orange-500' : opt.value === 'green' ? 'bg-green-500' : opt.value === 'blue' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}
                      />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">직접 입력 (#hex)</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      placeholder="#000000"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const hex = colorHex.trim().startsWith('#') ? colorHex.trim() : `#${colorHex.trim()}`
                        if (isHexColor(hex)) {
                          editor.chain().focus().setMark('textColor', { color: hex }).run()
                          setColorOpen(false)
                          setColorHex('')
                        }
                      }}
                      className="shrink-0 rounded bg-gray-800 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700"
                    >
                      적용
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="relative flex items-center gap-0.5">
          <button
            type="button"
            title="배경색 (글자 선택 후 적용)"
            onClick={() => { setHighlightOpen((o) => !o); setColorOpen(false); setFontSizeOpen(false) }}
            className="flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-sm text-gray-700 hover:bg-gray-200 hover:text-gray-900"
          >
            <span className="inline-block h-4 w-4 rounded border border-gray-400 bg-yellow-200" aria-hidden title="배경색" />
          </button>
          <span className="text-xs text-gray-500">배경</span>
          {highlightOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setHighlightOpen(false); setBgHex('') }} aria-hidden />
              <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                <div className="mb-2 grid grid-cols-2 gap-1">
                  {HIGHLIGHT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (opt.value === 'none') {
                          editor.chain().focus().unsetMark('highlight').run()
                        } else {
                          editor.chain().focus().setMark('highlight', { bgColor: opt.value }).run()
                        }
                        setHighlightOpen(false)
                      }}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100 ${currentBg === opt.value ? 'bg-gray-100 font-semibold text-gray-900' : ''}`}
                    >
                      <span className={`h-3 w-3 shrink-0 rounded border border-gray-300 ${opt.value === 'none' ? 'bg-white' : opt.className}`} />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">직접 입력 (#hex)</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={bgHex}
                      onChange={(e) => setBgHex(e.target.value)}
                      placeholder="#fef08a"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const hex = bgHex.trim().startsWith('#') ? bgHex.trim() : `#${bgHex.trim()}`
                        if (isHexColor(hex)) {
                          editor.chain().focus().setMark('highlight', { bgColor: hex }).run()
                          setHighlightOpen(false)
                          setBgHex('')
                        }
                      }}
                      className="shrink-0 rounded bg-gray-800 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700"
                    >
                      적용
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <span className="ml-2 text-xs text-gray-400">⌘B 굵게 · ⌘I 기울임 · 크기·색상·배경은 글자 선택 후 적용</span>
      </div>
      <div ref={editorRef} className={EDITOR_CLASS}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
