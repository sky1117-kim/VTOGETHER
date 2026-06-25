/** 세아웍스 직원 API·DB 행에서 공통 필드 추출 (필드명 변형 대응) */

export function getEmailFromSeahEmployeeRow(row: Record<string, unknown>): string | null {
  const email = row.email ?? row.mail ?? row.userEmail ?? row.emp_email ?? null
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null
}

export function getDeptNameFromSeahEmployeeRow(row: Record<string, unknown>): string | null {
  const dept =
    row.org_code_name ??
    row.orgCodeName ??
    row.dept_name ??
    row.deptName ??
    row.org_name ??
    row.orgName ??
    null
  return typeof dept === 'string' && dept.trim() ? dept.trim() : null
}

/** 직책(팀장 등) — 세아웍스는 job_duty_code 로 내려옴 */
export function getJobTitleFromSeahEmployeeRow(row: Record<string, unknown>): string | null {
  const candidates = [
    row.job_duty_code,
    row.jobDutyCode,
    row.job_title,
    row.jobTitle,
    row.position,
    row.position_name,
    row.positionName,
    row.duty_name,
    row.dutyName,
    row.title_name,
    row.titleName,
    row.jikchak_name,
    row.jikchakName,
    row.grade_name,
    row.gradeName,
    row.pos_name,
    row.posName,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

/** 팀장 여부 (직책 문자열 기준) */
export function isTeamLeaderJobTitle(jobTitle: string | null | undefined): boolean {
  if (!jobTitle?.trim()) return false
  return jobTitle.trim().includes('팀장')
}
