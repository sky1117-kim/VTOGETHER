'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchDepartments, fetchEmployees } from '@/lib/seah-orgsync'

type SyncResult = {
  success: boolean
  error?: string
  orgUnitsUpserted?: number
  employeesUpserted?: number
  usersSoftDeleted?: number
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

    // 퇴사/미재직 계정 자동 정리:
    // - users 중 활성 계정(deleted_at IS NULL)에서
    // - 관리자가 아닌 계정만 대상으로
    // - @vntg.co.kr 이메일인데, seah_employees에 재직(status_code != 'N')이 없으면 soft delete
    const { data: activeEmployees, error: employeeReadError } = await admin
      .from('seah_employees')
      .select('email, status_code')

    if (employeeReadError) {
      return { success: false, error: `직원 스냅샷 조회 실패: ${employeeReadError.message}` }
    }

    const activeEmailSet = new Set(
      (activeEmployees ?? [])
        .filter((row) => row.status_code !== 'N')
        .map((row) => row.email?.trim().toLowerCase())
        .filter((email): email is string => !!email)
    )

    const { data: currentUsers, error: usersReadError } = await admin
      .from('users')
      .select('user_id, email, is_admin')
      .is('deleted_at', null)

    if (usersReadError) {
      return { success: false, error: `사용자 조회 실패: ${usersReadError.message}` }
    }

    const toSoftDeleteIds = (currentUsers ?? [])
      .filter((u) => !u.is_admin)
      .filter((u) => {
        const email = (u.email ?? '').trim().toLowerCase()
        if (!email.endsWith('@vntg.co.kr')) return false
        return !activeEmailSet.has(email)
      })
      .map((u) => u.user_id)

    let usersSoftDeleted = 0
    if (toSoftDeleteIds.length > 0) {
      const now = new Date().toISOString()
      const { data: updatedRows, error: softDeleteError } = await admin
        .from('users')
        .update({ deleted_at: now, is_admin: false, updated_at: now })
        .in('user_id', toSoftDeleteIds)
        .is('deleted_at', null)
        .select('user_id')
      if (softDeleteError) {
        return { success: false, error: `퇴사자 계정 정리 실패: ${softDeleteError.message}` }
      }
      usersSoftDeleted = (updatedRows ?? []).length
    }

    return {
      success: true,
      orgUnitsUpserted: normalizedOrgRows.length,
      employeesUpserted: normalizedEmployees.length,
      usersSoftDeleted,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '세아웍스 동기화 실패',
    }
  }
}

