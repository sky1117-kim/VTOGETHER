/**
 * 기간제 이벤트 구간(라운드) 규칙 (docs/plan-rounds-logic.md)
 * 1구간: 1~10일 (인증 15일), 2구간: 11~20일 (인증 25일), 3구간: 21~말일 (인증 익월 5일)
 * 날짜는 서버 로컬 기준(또는 KST 권장) 해당 일 00:00 / 23:59:59.999 로 생성.
 */

export type RoundDateRange = {
  round_number: 1 | 2 | 3
  start_date: string
  end_date: string
  submission_deadline: string
}

/** 해당 월의 말일 (1~31) */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** 해당 연·월(1~12)에 대한 3구간 날짜 범위 생성. ISO 문자열 반환. */
export function getThreeRoundsForMonth(year: number, month: number): RoundDateRange[] {
  const m = month - 1
  const lastDay = getLastDayOfMonth(year, month)

  const toStart = (d: number) => new Date(year, m, d, 0, 0, 0, 0).toISOString()
  const toEnd = (d: number) => new Date(year, m, d, 23, 59, 59, 999).toISOString()

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextM = nextMonth - 1
  const deadline3 = new Date(nextYear, nextM, 5, 23, 59, 59, 999).toISOString()

  return [
    {
      round_number: 1,
      start_date: toStart(1),
      end_date: toEnd(10),
      submission_deadline: toEnd(15),
    },
    {
      round_number: 2,
      start_date: toStart(11),
      end_date: toEnd(20),
      submission_deadline: toEnd(25),
    },
    {
      round_number: 3,
      start_date: toStart(21),
      end_date: toEnd(lastDay),
      submission_deadline: deadline3,
    },
  ]
}
