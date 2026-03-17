/**
 * 세아웍스 API 디버그용 — 실제 응답 형식 확인
 * 로컬: http://localhost:3000/api/debug/seah-orgsync
 * 프로덕션: 관리자 로그인 후 /api/debug/seah-orgsync?email=본인이메일
 */
import { createClient } from '@/lib/supabase/server'
import { fetchEmployees, fetchEmployeesDebug, getDeptNameByEmail } from '@/lib/seah-orgsync'
import { NextResponse } from 'next/server'

function getEmailFromEmployee(e: Record<string, unknown>): string | null {
  const email = e.email ?? e.mail ?? e.userEmail ?? e.emp_email ?? null
  return typeof email === 'string' ? email : null
}

function getDeptFromEmployee(e: Record<string, unknown>): string | null {
  const dept = e.org_code_name ?? e.orgCodeName ?? e.dept_name ?? e.deptName ?? e.org_name ?? e.orgName ?? null
  return typeof dept === 'string' ? dept : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const testEmail = searchParams.get('email')?.trim()

  let currentUserEmail: string | null = null

  // 프로덕션: 관리자만 접근
  if (process.env.NODE_ENV === 'production') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
    }
    const { data: u } = await supabase.from('users').select('is_admin').eq('user_id', user.id).single()
    if (!u?.is_admin) {
      return NextResponse.json({ error: '관리자만 접근 가능' }, { status: 403 })
    }
    currentUserEmail = user.email ?? null
  }

  const debugResult = await fetchEmployeesDebug()
  if (!debugResult.ok) {
    return NextResponse.json({
      ok: false,
      message: '세아웍스 API 호출 실패',
      debug: debugResult,
      envCheck: {
        hasUrl: !!process.env.SEAH_ORGSYNC_USER_API_URL,
        hasUsername: !!process.env.SEAH_ORGSYNC_USERNAME,
        hasPassword: !!process.env.SEAH_ORGSYNC_PASSWORD,
      },
    })
  }

  const employees = debugResult.employees ?? []

  const firstKeys = employees[0] ? Object.keys(employees[0] as object) : []
  const sample = employees.slice(0, 3)

  // 이메일로 검색 테스트 (쿼리 파라미터 또는 로그인 사용자)
  const emailToTest = testEmail || currentUserEmail
  let deptResult: string | null = null
  let matchedEmployee: Record<string, unknown> | null = null

  if (emailToTest) {
    deptResult = await getDeptNameByEmail(emailToTest)
    matchedEmployee = (employees as Record<string, unknown>[]).find((e) => {
      const empEmail = getEmailFromEmployee(e)
      return empEmail?.toLowerCase() === emailToTest.toLowerCase()
    }) as Record<string, unknown> | null ?? null
  }

  // 이메일 필드가 다른 직원 찾기 (sky1117 등 로컬파트로)
  const localPart = emailToTest?.split('@')[0]?.toLowerCase()
  const byLocalPart = localPart
    ? (employees as Record<string, unknown>[]).find((e) => {
        const empEmail = getEmailFromEmployee(e)
        return empEmail?.toLowerCase().startsWith(localPart + '@') || empEmail?.toLowerCase().includes(localPart)
      })
    : null

  return NextResponse.json({
    ok: true,
    totalCount: employees.length,
    firstRecordKeys: firstKeys,
    sample,
    testEmail: emailToTest,
    deptForEmail: deptResult,
    matchedEmployee: matchedEmployee ? { email: getEmailFromEmployee(matchedEmployee), dept: getDeptFromEmployee(matchedEmployee) } : null,
    byLocalPart: byLocalPart ? { email: getEmailFromEmployee(byLocalPart), dept: getDeptFromEmployee(byLocalPart) } : null,
    // totalCount 0일 때 실제 API 응답 구조 확인용
    ...(employees.length === 0 && {
      rawResponse: {
        bodyPreview: debugResult.bodyPreview,
        rawStructure: debugResult.rawStructure,
      },
    }),
  })
}
