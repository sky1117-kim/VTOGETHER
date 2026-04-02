/**
 * Supabase 공개 URL·anon 키 (브라우저에 전달해도 되는 값).
 * NEXT_PUBLIC_* 는 `next build` 시점에 JS 번들에 상수로 박히는데, Cloud Run Docker 빌드에서는
 * .env 가 없어 빈 문자열로 박힐 수 있습니다. 런타임 --set-env-vars 만으로는 클라이언트 번들을 고칠 수 없습니다.
 * SERVER_SUPABASE_PUBLIC_* 는 NEXT_PUBLIC_ 접두사가 없어 서버/Edge에서 런타임 process.env 로만 읽힙니다.
 */
export function getSupabasePublicCredentials(): { url: string; anonKey: string } {
  const url = (
    process.env.SERVER_SUPABASE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim()
  const anonKey = (
    process.env.SERVER_SUPABASE_PUBLIC_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim()
  return { url, anonKey }
}
