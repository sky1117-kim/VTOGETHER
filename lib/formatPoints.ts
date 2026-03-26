/**
 * 크레딧 숫자를 읽기 쉬운 문자열로 (예: 100000 → "10만 C", 40000000 → "4,000만 C")
 */
export function formatPoints(n: number): string {
  if (n >= 100_000_000) {
    const eok = n / 100_000_000
    return (eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(1)) + '억 C'
  }
  if (n >= 10_000) {
    const man = n / 10_000
    return (man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)) + '만 C'
  }
  return n.toLocaleString() + ' C'
}
