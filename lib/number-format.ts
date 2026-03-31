// 숫자 입력에서 숫자 이외 문자를 제거합니다. (정수 전용)
export function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D/g, '')
}

// 정수 문자열을 천 단위 콤마 형식으로 변환합니다.
export function formatIntegerWithCommas(value: string | number | null | undefined): string {
  if (value == null) return ''
  const raw = typeof value === 'number' ? String(value) : value
  const digits = sanitizeIntegerInput(raw)
  if (!digits) return ''
  return Number(digits).toLocaleString('ko-KR')
}

// 소수 입력에서 숫자와 점(.) 1개만 남깁니다.
export function sanitizeDecimalInput(value: string): string {
  const base = value.replace(/,/g, '').replace(/[^\d.]/g, '')
  const firstDot = base.indexOf('.')
  if (firstDot === -1) return base
  return base.slice(0, firstDot + 1) + base.slice(firstDot + 1).replace(/\./g, '')
}

// 소수 문자열을 천 단위 콤마 형식으로 변환합니다.
export function formatDecimalWithCommas(value: string): string {
  const sanitized = sanitizeDecimalInput(value)
  if (!sanitized) return ''
  const [intPart, decPart] = sanitized.split('.')
  const formattedInt = Number(intPart || 0).toLocaleString('ko-KR')
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt
}
