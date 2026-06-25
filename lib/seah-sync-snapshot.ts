import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchDepartments, fetchEmployees } from '@/lib/seah-orgsync'
import { getJobTitleFromSeahEmployeeRow } from '@/lib/seah-employee-fields'

export type SeahSyncResult = {
  success: boolean
  error?: string
  orgUnitsUpserted?: number
  employeesUpserted?: number
  usersSoftDeleted?: number
  /** job_title 컬럼 없어 직책 없이 저장한 경우 */
  jobTitleSkipped?: boolean
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

function isMissingJobTitleColumn(message?: string | null): boolean {
  return !!message?.includes('job_title')
}

/** 세아웍스 API → seah_org_units / seah_employees 스냅샷 (서버·스크립트 공용) */
export async function runSeahOrgsyncSnapshot(admin: SupabaseClient): Promise<SeahSyncResult> {
  const [orgRows, employeeRows] = await Promise.all([fetchDepartments(), fetchEmployees()])
  if (!orgRows || !employeeRows) {
    return { success: false, error: '세아웍스 API 호출 실패 (환경변수/네트워크 확인)' }
  }

  const nowIso = new Date().toISOString()

  const normalizedOrgRows = orgRows
    .map((row) => {
      const raw = row as Record<string, unknown>
      const orgCode = normalizeText(raw.org_code)
      const orgName = normalizeText(raw.org_code_name) ?? normalizeText(raw.org_name)
      const parentOrgCode = normalizeText(raw.parent_org_code)
      const statusCode = normalizeText(raw.status_code)
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
        job_title: getJobTitleFromSeahEmployeeRow(raw),
        status_code: normalizeText(raw.status_code ?? raw.statusCode),
        emp_no: normalizeText(raw.emp_no),
        synced_at: nowIso,
      }
    })
    .filter((v): v is NonNullable<typeof v> => !!v)

  let jobTitleSkipped = false
  if (normalizedEmployees.length > 0) {
    const withTitle = normalizedEmployees
    let employeeError = (
      await admin.from('seah_employees').upsert(withTitle, { onConflict: 'email' })
    ).error

    if (employeeError && isMissingJobTitleColumn(employeeError.message)) {
      jobTitleSkipped = true
      const withoutTitle = withTitle.map(({ job_title: _jt, ...rest }) => rest)
      employeeError = (await admin.from('seah_employees').upsert(withoutTitle, { onConflict: 'email' })).error
    }

    if (employeeError) return { success: false, error: `직원 upsert 실패: ${employeeError.message}` }
  }

  const { error: usersDeptSyncError } = await admin.rpc('sync_users_dept_name_from_seah_snapshot')
  if (usersDeptSyncError) {
    return { success: false, error: `users.dept_name 동기화 실패: ${usersDeptSyncError.message}` }
  }

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
    jobTitleSkipped,
  }
}
