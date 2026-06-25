import { createAdminClient } from '@/lib/supabase/admin'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const EXCLUDED_LEADER_EMAILS = new Set(['tg@vntgcorp.com'])

function getLeaderPriority(jobTitle: string | null | undefined): number {
  const title = (jobTitle ?? '').trim()
  if (!title) return -1
  // 낮은 숫자일수록 우선순위가 높음
  if (title.includes('팀장')) return 0
  if (title.includes('센터장')) return 1
  if (title.includes('실장')) return 2
  if (title.includes('본부장')) return 3
  if (title.includes('총괄')) return 4
  if (title.includes('단장')) return 5
  if (title.includes('대표')) return 6
  return -1
}

type SeahEmpLite = {
  email: string | null
  org_code: string | null
  job_title: string | null
  status_code: string | null
}

type SeahOrgLite = {
  org_code: string
  parent_org_code: string | null
}

function pickLeaderEmail(
  members: SeahEmpLite[] | undefined,
  requesterEmail: string,
  activeUserEmailSet: Set<string>
): string | null {
  if (!members?.length) return null

  const candidates = members
    .filter((m) => m.status_code !== 'N')
    .filter((m) => typeof m.email === 'string' && m.email.trim().length > 0)
    .filter((m) => normalizeEmail(m.email!) !== requesterEmail)
    .filter((m) => !EXCLUDED_LEADER_EMAILS.has(normalizeEmail(m.email!)))
    .filter((m) => activeUserEmailSet.has(normalizeEmail(m.email!)))
    .map((m) => ({
      email: normalizeEmail(m.email!),
      priority: getLeaderPriority(m.job_title),
    }))
    .filter((m) => m.priority >= 0)
    .sort((a, b) => a.priority - b.priority || a.email.localeCompare(b.email))

  return candidates[0]?.email ?? null
}

/**
 * 수신자 조직부터 상위 조직까지 올라가며 조직장 이메일 목록을 찾는다.
 * - 각 조직(org_code)에서 우선순위가 가장 높은 1명을 선택
 * - 같은 이메일은 중복 제거
 * 우선순위: 팀장 > 센터장 > 실장 > 본부장 > 총괄 > 단장 > 대표
 */
export async function findHierarchyLeaderEmailsForEmployee(employeeEmail: string): Promise<string[]> {
  const email = normalizeEmail(employeeEmail)
  if (!email) return []

  try {
    const admin = createAdminClient()
    const { data: emp, error: empErr } = await admin
      .from('seah_employees')
      .select('org_code, email')
      .eq('email', email)
      .maybeSingle()

    if (empErr) {
      if (empErr.message?.includes('job_title')) {
        // 컬럼 없음 등 — 참조 스킵
        return []
      }
      return []
    }
    if (!emp?.org_code) return []

    // 재직 직원 전체를 먼저 가져와 org_code별로 인덱싱
    const { data: employees, error: peerErr } = await admin
      .from('seah_employees')
      .select('email, org_code, job_title, status_code')

    if (peerErr || !employees?.length) return []

    const membersByOrg = new Map<string, SeahEmpLite[]>()
    for (const row of employees) {
      const code = (row.org_code ?? '').trim()
      if (!code) continue
      if (!membersByOrg.has(code)) membersByOrg.set(code, [])
      membersByOrg.get(code)!.push(row)
    }

    // 실제 서비스 활성 사용자(users.deleted_at is null)만 CC 대상으로 허용
    const { data: activeUsers, error: usersErr } = await admin
      .from('users')
      .select('email')
      .is('deleted_at', null)
    if (usersErr) return []
    const activeUserEmailSet = new Set(
      (activeUsers ?? [])
        .map((u) => (typeof u.email === 'string' ? normalizeEmail(u.email) : ''))
        .filter(Boolean)
    )

    // 조직 트리(parent_org_code)를 읽어 상위 조직으로 탐색
    const { data: orgUnits, error: orgErr } = await admin
      .from('seah_org_units')
      .select('org_code, parent_org_code')
    if (orgErr || !orgUnits?.length) return []

    const parentByOrg = new Map<string, string | null>()
    for (const org of orgUnits as SeahOrgLite[]) {
      parentByOrg.set(org.org_code, org.parent_org_code ?? null)
    }

    let currentOrg: string | null = emp.org_code
    const visited = new Set<string>()
    const collected = new Set<string>()
    // 순환 방지 + 비정상 트리 방어
    for (let depth = 0; depth < 12 && currentOrg; depth += 1) {
      if (visited.has(currentOrg)) break
      visited.add(currentOrg)

      const leaderEmail = pickLeaderEmail(membersByOrg.get(currentOrg), email, activeUserEmailSet)
      if (leaderEmail) collected.add(leaderEmail)

      currentOrg = parentByOrg.get(currentOrg) ?? null
    }

    return [...collected]
  } catch {
    return []
  }
}

/** 하위 호환: 기존 단일 리더 조회(첫 번째 우선순위 리더) */
export async function findTeamLeaderEmailForEmployee(employeeEmail: string): Promise<string | null> {
  const emails = await findHierarchyLeaderEmailsForEmployee(employeeEmail)
  return emails[0] ?? null
}
