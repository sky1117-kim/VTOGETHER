/**
 * OAuth `redirect_to` 등에 쓰는 공개 앱 베이스 URL(스킴 + 호스트 [+ 포트], 끝 슬래시 없음).
 *
 * - `npm run dev` (NODE_ENV=development): `.env`에 프로덕션 도메인이 있어도 기본은 localhost로 고정
 *   (로컬에서 구글 로그인 후 프로덕션 URL로 보내지는 문제 방지)
 * - `next start` / Cloud Run 등 프로덕션: `NEXT_PUBLIC_APP_URL` 사용
 *
 * 로컬에서만 다른 주소(ngrok 등)를 쓰려면 `.env.local`에 `NEXT_PUBLIC_DEV_APP_URL`을 넣으세요.
 */
export function getPublicAppOrigin(): string {
  const isDev = process.env.NODE_ENV === 'development'
  if (isDev) {
    const devOverride = process.env.NEXT_PUBLIC_DEV_APP_URL?.trim()
    if (devOverride) {
      return normalizeOrigin(devOverride)
    }
    return 'http://localhost:3000'
  }
  return normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
}

function normalizeOrigin(raw: string): string {
  let s = raw.trim().replace(/\/$/, '')
  if (!s) {
    return 'http://localhost:3000'
  }
  if (!/^https?:\/\//i.test(s)) {
    if (
      s.startsWith('localhost') ||
      s.startsWith('127.0.0.1') ||
      s.startsWith('0.0.0.0')
    ) {
      s = `http://${s}`
    } else {
      s = `https://${s}`
    }
  }
  return s.replace(/\/$/, '')
}
