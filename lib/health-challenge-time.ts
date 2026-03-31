/** 서울 기준 연·월 (집계·표시 통일) */
export function getSeoulYearMonth(d = new Date()): { year: number; month: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = fmt.formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  return { year: Number(y), month: Number(m) }
}

/** YYYY-MM-DD → 연·월 (날짜 문자열만 사용, 타임존 혼선 방지) */
export function yearMonthFromISODate(isoDate: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) }
}

/** TIMESTAMPTZ → Asia/Seoul 달력 날짜 YYYY-MM-DD */
export function isoTimestampToSeoulDateString(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export function isActivityDateInSeasonRange(
  activityDateYmd: string,
  seasonStartsAt: string,
  seasonEndsAt: string
): boolean {
  const start = isoTimestampToSeoulDateString(seasonStartsAt)
  const end = isoTimestampToSeoulDateString(seasonEndsAt)
  const a = activityDateYmd.trim()
  return a >= start && a <= end
}
