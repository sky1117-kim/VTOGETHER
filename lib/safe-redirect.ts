/**
 * 로그인 후 이동할 경로(`next` 쿼리 파라미터)가 안전한 같은-출처 상대경로인지 검증합니다.
 * `//evil.com`, `/\evil.com` 처럼 `/`로 시작하지만 브라우저가 다른 호스트로 해석하는
 * 프로토콜 상대(protocol-relative) URL을 걸러내 오픈 리다이렉트를 막습니다.
 */
export function isSafeNextPath(next?: string | null): next is string {
  if (!next) return false
  if (!next.startsWith('/')) return false
  if (next.startsWith('//')) return false
  if (next.startsWith('/\\')) return false
  return true
}

/** next가 안전하면 그대로, 아니면 기본 경로('/')를 반환합니다. */
export function toSafeNextPath(next?: string | null, fallback = '/'): string {
  return isSafeNextPath(next) ? next : fallback
}
