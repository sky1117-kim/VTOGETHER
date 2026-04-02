import { createClient } from '@supabase/supabase-js'
import { getSupabasePublicCredentials } from '@/lib/supabase/public-credentials'

/**
 * 서버 전용. RLS 우회(관리자 작업)용입니다.
 * SUPABASE_SERVICE_ROLE_KEY는 절대 클라이언트에 노출하지 마세요.
 */
export function createAdminClient() {
  const { url } = getSupabasePublicCredentials()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or SERVER_SUPABASE_PUBLIC_URL / NEXT_PUBLIC_SUPABASE_URL'
    )
  }
  return createClient(url, key)
}
