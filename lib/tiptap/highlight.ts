import { Mark, mergeAttributes } from '@tiptap/core'

export type HighlightColorValue = 'none' | 'yellow' | 'green' | 'blue' | 'pink' | string

/** 배경색(하이라이트) 마크. data-bg-color로 저장. 모달에서도 동일 적용 */
export const Highlight = Mark.create({
  name: 'highlight',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      bgColor: {
        default: 'none',
        parseHTML: (element) => element.getAttribute('data-bg-color') || 'none',
        renderHTML: (attributes) => {
          if (!attributes.bgColor || attributes.bgColor === 'none') return {}
          return { 'data-bg-color': attributes.bgColor }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-bg-color]',
        getAttrs: (el) => ({ bgColor: (el as HTMLElement).getAttribute('data-bg-color') || 'none' }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})

export const HIGHLIGHT_OPTIONS: { value: string; label: string; className: string }[] = [
  { value: 'none', label: '없음', className: 'bg-transparent' },
  { value: 'yellow', label: '노랑', className: 'bg-yellow-200' },
  { value: 'green', label: '연두', className: 'bg-green-200' },
  { value: 'blue', label: '하늘', className: 'bg-sky-200' },
  { value: 'pink', label: '분홍', className: 'bg-pink-200' },
]
