/**
 * 세아웍스 API 디버그용 — 실제 응답 형식 확인
 * 로컬: http://localhost:3000/api/debug/seah-orgsync
 * 프로덕션: SEAH_ORGSYNC_DEBUG_ENABLED=true 로 명시적으로 켜야만 접근 가능(관리자 로그인 필요, ?email=본인이메일)
 *
 * NODE_ENV만으로 게이트하면 배포 환경변수 설정 실수 시 직원 PII가 그대로 노출되므로,
 * 프로덕션에서는 별도 플래그를 추가로 요구해 이중 게이트를 둡니다.
 */
import { createClient } from '@/lib/supabase/server'
import { fetchEmployeesDebug, getDeptNameByEmail } from '@/lib/seah-orgsync'
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

  const isProd = process.env.NODE_ENV === 'production'
  // 프로덕션에서는 명시적 플래그 없이는 라우트 자체를 숨김(존재 자체를 404로)
  if (isProd && process.env.SEAH_ORGSYNC_DEBUG_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  // 프로덕션: 관리자만 접근
  if (isProd) {
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
