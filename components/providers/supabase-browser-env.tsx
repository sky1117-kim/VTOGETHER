'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type SupabaseBrowserEnv = { url: string; anonKey: string }

const SupabaseBrowserEnvContext = createContext<SupabaseBrowserEnv | null>(null)

export function SupabaseBrowserEnvProvider({
  url,
  anonKey,
  children,
}: SupabaseBrowserEnv & { children: ReactNode }) {
  return (
    <SupabaseBrowserEnvContext.Provider value={{ url, anonKey }}>
      {children}
    </SupabaseBrowserEnvContext.Provider>
  )
}

/** 로그인·스토리지 업로드 등 브라우저용 Supabase 설정 (서버가 RSC로 주입) */
export function useSupabaseBrowserEnv(): SupabaseBrowserEnv | null {
  return useContext(SupabaseBrowserEnvContext)
}
