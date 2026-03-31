import { Mark, mergeAttributes } from '@tiptap/core'

export type TextColorValue =
  | 'black'
  | 'gray'
  | 'red'
  | 'orange'
  | 'green'
  | 'blue'
  | 'purple'
  | (string & {}) // hex 등 커스텀 값 허용

/** 텍스트 색상 마크. data-color로 저장(프리셋 이름 또는 #hex). 모달에서도 동일 스타일 적용 */
export const TextColor = Mark.create({
  name: 'textColor',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      color: {
        default: 'black',
        parseHTML: (element) => element.getAttribute('data-color') || 'black',
        renderHTML: (attributes) => {
          if (!attributes.color || attributes.color === 'black') return {}
          return { 'data-color': attributes.color }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-color]',
        getAttrs: (el) => ({ color: (el as HTMLElement).getAttribute('data-color') || 'black' }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})

export const TEXT_COLOR_OPTIONS: { value: TextColorValue; label: string; className: string }[] = [
  { value: 'black', label: '검정', className: 'text-gray-900' },
  { value: 'gray', label: '회색', className: 'text-gray-500' },
  { value: 'red', label: '빨강', className: 'text-red-600' },
  { value: 'orange', label: '주황', className: 'text-orange-600' },
  { value: 'green', label: '초록', className: 'text-green-600' },
  { value: 'blue', label: '파랑', className: 'text-blue-600' },
  { value: 'purple', label: '보라', className: 'text-purple-600' },
]
