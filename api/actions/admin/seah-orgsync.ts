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

