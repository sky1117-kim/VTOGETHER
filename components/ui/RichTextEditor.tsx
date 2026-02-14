'use client'

import { useEffect, useId } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

const EDITOR_CLASS = 'min-h-[240px] w-full px-3 py-2 text-gray-900 outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0'

/** HTML을 저장. ⌘B/⌘I로 입력창에서 바로 굵게/기울임 적용되는 WYSIWYG */
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
    },
  })

  // 부모에서 value가 바뀌었을 때(예: 다른 이벤트 선택) 에디터 내용 동기화
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value?.trim() ? value : '<p></p>'
    if (current !== next) editor.commands.setContent(next, false)
  }, [editor, value])

  if (!editor) return null

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
        <span className="ml-2 text-xs text-gray-400">⌘B 굵게 · ⌘I 기울임</span>
      </div>
      <div className={EDITOR_CLASS}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
