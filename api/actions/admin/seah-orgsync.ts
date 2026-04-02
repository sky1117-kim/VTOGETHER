'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchDepartments, fetchEmployees } from '@/lib/seah-orgsync'

type SyncResult = {
  success: boolean
  error?: string
  orgUnitsUpserted?: number
  employeesUpserted?: number
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

/**
 * 세아웍스 조직/직원 스냅샷 동기화
 * - 조직: seah_org_units
 * - 직원: seah_employees
 * - 삭제 대신 is_active/status_code로 비활성 처리
 */
export async function syncSeahOrgsyncSnapshot(): Promise<SyncResult> {
  try {
    const [orgRows, employeeRows] = await Promise.all([fetchDepartments(), fetchEmployees()])
    if (!orgRows || !employeeRows) {
      return { success: false, error: '세아웍스 API 호출 실패 (환경변수/네트워크 확인)' }
    }

    const admin = createAdminClient()
    const nowIso = new Date().toISOString()

    const normalizedOrgRows = orgRows
      .map((row) => {
        const orgCode = normalizeText((row as Record<string, unknown>).org_code)
        const orgName =
          normalizeText((row as Record<string, unknown>).org_code_name) ??
          normalizeText((row as Record<string, unknown>).org_name)
        const parentOrgCode = normalizeText((row as Record<string, unknown>).parent_org_code)
        const statusCode = normalizeText((row as Record<string, unknown>).status_code)
        if (!orgCode || !orgName) return null
        return {
          org_code: orgCode,
          org_name: orgName,
          parent_org_code: parentOrgCode,
          is_active: statusCode !== 'N',
          synced_at: nowIso,
        }
      })
      .filter((v): v is NonNullable<typeof v> => !!v)

    if (normalizedOrgRows.length > 0) {
      const { error: orgError } = await admin
        .from('seah_org_units')
        .upsert(normalizedOrgRows, { onConflict: 'org_code' })
      if (orgError) return { success: false, error: `조직 upsert 실패: ${orgError.message}` }
    }

    const normalizedEmployees = employeeRows
      .map((row) => {
        const raw = row as Record<string, unknown>
        const email = normalizeEmail(raw.email ?? raw.mail ?? raw.userEmail ?? raw.emp_email)
        if (!email) return null
        return {
          email,
          name: normalizeText(raw.name),
          org_code: normalizeText(raw.org_code),
          status_code: normalizeText(raw.status_code ?? raw.statusCode),
          emp_no: normalizeText(raw.emp_no),
          synced_at: nowIso,
        }
      })
      .filter((v): v is NonNullable<typeof v> => !!v)

    if (normalizedEmployees.length > 0) {
      const { error: employeeError } = await admin
        .from('seah_employees')
        .upsert(normalizedEmployees, { onConflict: 'email' })
      if (employeeError) return { success: false, error: `직원 upsert 실패: ${employeeError.message}` }
    }

    // 스냅샷 동기화 후 users.dept_name 일괄 보정
    // - 기존 로그인 시점 보정만으로는 이미 생성된 사용자의 NULL 부서가 남을 수 있어,
    //   배치 한 번으로 전체를 최신 조직명으로 맞춥니다.
    const { error: usersDeptSyncError } = await admin.rpc('sync_users_dept_name_from_seah_snapshot')
    if (usersDeptSyncError) {
      // RPC가 없는 환경(마이그레이션 미적용) 대비: 앱 자체 실패는 막고 원인만 반환
      return {
        success: false,
        error: `users.dept_name 동기화 실패: ${usersDeptSyncError.message}`,
      }
    }

    return {
      success: true,
      orgUnitsUpserted: normalizedOrgRows.length,
      employeesUpserted: normalizedEmployees.length,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '세아웍스 동기화 실패',
    }
  }
}

