/** event_verification_methods.options(JSONB)에서 객관식 선택지 문자열 배열 추출 */
export function parseChoiceOptions(options: unknown): string[] {
  if (!options) return []
  if (Array.isArray(options)) {
    return options
      .map((o) => (typeof o === 'string' ? o.trim() : String(o ?? '').trim()))
      .filter(Boolean)
  }
  if (typeof options === 'string') {
    const t = options.trim()
    if (!t) return []
    try {
      const parsed = JSON.parse(t) as unknown
      if (Array.isArray(parsed)) return parseChoiceOptions(parsed)
    } catch {
      return [t]
    }
  }
  return []
}
