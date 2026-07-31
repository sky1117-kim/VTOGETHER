/**
 * 로그인 후 이동할 경로(`next` 쿼리 파라미터)가 안전한 같은-출처 상대경로인지 검증합니다.
 *
 * 문자열 접두사만 보는 방식(`//evil.com`, `/\evil.com` 차단)은 `/\t/evil.com`처럼 탭·개행 같은
 * 제어문자를 앞에 끼워 넣는 우회에 뚫립니다 — WHATWG URL 파서(브라우저의 Location 헤더 해석 포함)가
 * 파싱 전에 탭(\t)·개행(\n)·캐리지리턴(\r)을 제거해버려서, 검사 시점에는 안전해 보이던 문자열이
 * 실제 리다이렉트 시점에는 `//evil.com`과 동일하게 해석되기 때문입니다.
 * 그래서 문자열 검사에 더해 실제로 URL을 파싱한 뒤 origin이 그대로인지까지 재확인합니다.
 */
const SAFE_REDIRECT_PLACEHOLDER_ORIGIN = 'https://safe-redirect-placeholder.local'

export function isSafeNextPath(next?: string | null): next is string {
  if (!next) return false
  if (typeof next !== 'string') return false
  // URL 파서가 파싱 전에 제거하는 제어문자가 섞여 있으면 무조건 거부
  if (/[\x00-\x1F\x7F]/.test(next)) return false
  if (!next.startsWith('/')) return false
  if (next.startsWith('//')) return false
  if (next.startsWith('/\\')) return false

  let resolved: URL
  try {
    resolved = new URL(next, SAFE_REDIRECT_PLACEHOLDER_ORIGIN)
  } catch {
    return false
  }
  return resolved.origin === SAFE_REDIRECT_PLACEHOLDER_ORIGIN
}

/** next가 안전하면 그대로, 아니면 기본 경로('/')를 반환합니다. */
export function toSafeNextPath(next?: string | null, fallback = '/'): string {
  return isSafeNextPath(next) ? next : fallback
}
