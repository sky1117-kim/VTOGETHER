'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { runSeahOrgsyncSnapshot } from '@/lib/seah-sync-snapshot'

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
