import { Mark, mergeAttributes } from '@tiptap/core'

export type FontSizeValue = 'small' | 'normal' | 'large'

/** 폰트 크기 마크. data-size로 저장해 모달에서도 동일 스타일 적용 */
export const FontSize = Mark.create({
  name: 'fontSize',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      size: {
        default: 'normal' as FontSizeValue,
        parseHTML: (element) =>
          (element.getAttribute('data-size') as FontSizeValue) || 'normal',
        renderHTML: (attributes) => {
          if (attributes.size === 'normal') return {}
          return { 'data-size': attributes.size }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-size]',
        getAttrs: (el) => ({ size: (el as HTMLElement).getAttribute('data-size') || 'normal' }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})

export const FONT_SIZE_OPTIONS: { value: FontSizeValue; label: string }[] = [
  { value: 'small', label: '작게' },
  { value: 'normal', label: '보통' },
  { value: 'large', label: '크게' },
]
