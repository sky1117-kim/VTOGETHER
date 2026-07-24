import { createAdminClient } from '@/lib/supabase/admin'
import { runSeahOrgsyncSnapshot } from '@/lib/seah-sync-snapshot'

// 주의: 이 파일은 의도적으로 'use server'를 쓰지 않습니다.
// syncSeahOrgsyncSnapshot()은 크론 시크릿(SEAH_ORGSYNC_CRON_SECRET)으로 보호되는
// app/api/cron/seah-orgsync/route.ts에서만 호출되어야 하며, 'use server'로 내보내면
// 이 함수가 로그인 세션 없이도 직접 호출 가능한 공개 Server Action이 되어
// 크론 보호를 우회할 수 있습니다.

export type SyncResult = {
  success: boolean
  error?: string
  orgUnitsUpserted?: number
  employeesUpserted?: number
  usersSoftDeleted?: number
  jobTitleSkipped?: boolean
}

/** 세아웍스 조직/직원 스냅샷 동기화 (크론·관리 스크립트·배포 후 호출) */
export async function syncSeahOrgsyncSnapshot(): Promise<SyncResult> {
  try {
    const admin = createAdminClient()
    return await runSeahOrgsyncSnapshot(admin)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '세아웍스 동기화 실패',
    }
  }
}
