/**
 * 포인트 숫자를 읽기 쉬운 문자열로 (예: 100000 → "10만 P", 40000000 → "4,000만 P")
 */
export function formatPoints(n: number): string {
  if (n >= 100_000_000) {
    const eok = n / 100_000_000
    return (eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(1)) + '억 P'
  }
  if (n >= 10_000) {
    const man = n / 10_000
    return (man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)) + '만 P'
  }
  return n.toLocaleString() + ' P'
}
