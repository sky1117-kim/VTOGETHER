import { getSupabasePublicCredentials } from '@/lib/supabase/public-credentials'
import { SupabaseBrowserEnvProvider } from './supabase-browser-env'
import type { ReactNode } from 'react'

/** 서버에서 런타임 env를 읽어 클라이언트 전역에 Supabase 공개 설정을 심습니다. */
export function SupabaseBrowserBridge({ children }: { children: ReactNode }) {
  const { url, anonKey } = getSupabasePublicCredentials()
  return (
    <SupabaseBrowserEnvProvider url={url} anonKey={anonKey}>
      {children}
    </SupabaseBrowserEnvProvider>
  )
}
