/**
 * 세아웍스 인사 연동 REST API 클라이언트
 * VNTG 그룹웨어서비스팀 정선우 담당자 발급 API
 * - 사용자(직원) 정보: 부서명(dept_name) 동기화
 * - 조직도: 부서 계층 구조 (향후 칭찬 챌린지 등 활용)
 */

const SYSTEM_ID = 'VTOGETHER'
const COMPANY_CODE = ['ORG_Seah']

/** 직원 API 응답 항목 (정의서 기준) */
export interface SeahEmployee {
  email?: string
  name?: string
  org_code_name?: string // 부서명
  org_code?: string // 부서 코드
  emp_no?: string
  status_code?: string // Y=재직, N=퇴사
}

/** 조직도 API 응답 항목 (정의서 기준) */
export interface SeahDepartment {
  org_code?: string
  org_code_name?: string
  parent_org_code?: string
  manager_id?: string
}

/** Basic Auth 헤더 생성 (env 없으면 null, throw 안 함) */
function getBasicAuthHeader(): string | null {
  const username = process.env.SEAH_ORGSYNC_USERNAME?.trim()
  const password = process.env.SEAH_ORGSYNC_PASSWORD?.trim()
  if (!username || !password) return null
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

/** 공통 요청 바디 (정의서: system_id, company_code 고정) */
const REQUEST_BODY = {
  system_id: SYSTEM_ID,
  company_code: COMPANY_CODE,
}

/** 디버그용: API 호출 상세 결과 (실패 원인 파악) */
export interface FetchEmployeesDebugResult {
  ok: boolean
  status?: number
  statusText?: string
  bodyPreview?: string
  rawStructure?: string
  error?: string
  hint?: string
  listType?: string
  employees?: SeahEmployee[] | null
}

/**
 * 직원 목록 조회 — 디버그용 (실패 시 상세 정보 반환)
 */
export async function fetchEmployeesDebug(): Promise<FetchEmployeesDebugResult> {
  const url = process.env.SEAH_ORGSYNC_USER_API_URL?.trim()
  const auth = getBasicAuthHeader()
  if (!url || !auth) {
    return { ok: false, error: 'URL 또는 인증 정보 없음' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000) // 20초 (세아웍스 API 응답 지연 대응)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify(REQUEST_BODY),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const rawText = await res.text()
    const bodyPreview = rawText.slice(0, 500)

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        bodyPreview,
        error: `HTTP ${res.status} ${res.statusText}`,
      }
    }

    let data: unknown
    try {
      data = JSON.parse(rawText)
    } catch {
      return { ok: false, bodyPreview, error: '응답이 JSON이 아님' }
    }

    const obj = data as Record<string, unknown>
    let list: unknown[] = []
    if (Array.isArray(data)) {
      list = data
    } else if (obj) {
      const candidates = [
        obj.data,
        obj.DATA, // 세아웍스 API: {"CODE":"CD_SUCCESS","DATA":{"list":[...]}}
        obj.items,
        obj.result,
        obj.list,
        obj.employeeList,
        obj.employees,
        (obj.data as Record<string, unknown>)?.list,
        (obj.DATA as Record<string, unknown>)?.list,
        (obj.data as Record<string, unknown>)?.items,
        (obj.DATA as Record<string, unknown>)?.items,
      ]
      for (const c of candidates) {
        if (Array.isArray(c)) {
          list = c
          break
        }
      }
    }
    if (!Array.isArray(list)) {
      return {
        ok: false,
        bodyPreview,
        rawStructure: JSON.stringify(Object.keys(obj ?? {})),
        listType: typeof list,
        error: '응답에 배열이 없음 (data/items/result/list 등 확인)',
      }
    }

    const filtered = list.filter((e: unknown) => {
      const r = e as Record<string, unknown>
      const status = r.status_code ?? r.statusCode
      return status !== 'N' && status !== 'n'
    }) as SeahEmployee[]

    // totalCount 0이면 실제 응답 구조 확인용
    const rawStructure = JSON.stringify(
      typeof data === 'object' && data !== null ? Object.keys(data as object) : typeof data
    )

    return {
      ok: true,
      employees: filtered,
      bodyPreview: rawText.slice(0, 800),
      rawStructure: Array.isArray(data) ? 'array' : rawStructure,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isAbort = msg.includes('aborted')
    return {
      ok: false,
      error: msg,
      ...(isAbort && { hint: '타임아웃(20초). 세아웍스 API가 Cloud Run IP를 허용하는지, 또는 사내망 전용인지 VNTG 그룹웨어서비스팀에 문의하세요.' }),
    }
  }
}

/**
 * 직원 목록 조회 (세아웍스 employees API)
 * @returns 재직자(Y) 목록, 실패 시 null
 */
export async function fetchEmployees(): Promise<SeahEmployee[] | null> {
  const result = await fetchEmployeesDebug()
  return result.ok ? result.employees ?? null : null
}

/** 직원 레코드에서 부서명 추출 (정의서: org_code_name, 실제 API는 다른 필드명일 수 있음) */
function getDeptFromEmployee(e: SeahEmployee): string | null {
  const r = e as Record<string, unknown>
  const dept =
    r.org_code_name ?? r.orgCodeName ?? r.dept_name ?? r.deptName ?? r.org_name ?? r.orgName ?? null
  return typeof dept === 'string' ? dept : null
}

/** 직원 레코드에서 이메일 추출 */
function getEmailFromEmployee(e: SeahEmployee): string | null {
  const r = e as Record<string, unknown>
  const email = r.email ?? r.mail ?? r.userEmail ?? r.emp_email ?? null
  return typeof email === 'string' ? email : null
}

/**
 * 이메일로 직원 정보 조회 (부서명 등)
 * @param email 사용자 이메일 (예: sky1117@vntgcorp.com)
 * @returns 부서명(org_code_name) 또는 null
 */
export async function getDeptNameByEmail(email: string): Promise<string | null> {
  const employees = await fetchEmployees()
  if (!employees?.length) return null

  const normalizedEmail = email?.toLowerCase().trim()
  const localPart = normalizedEmail?.split('@')[0] ?? ''

  // 1) 정확히 일치
  let found = employees.find((e) => {
    const empEmail = getEmailFromEmployee(e)
    return empEmail?.toLowerCase().trim() === normalizedEmail
  })

  // 2) 로컬 파트(sky1117)로 시작하는 이메일 (도메인 차이 대응: @vntgcorp.com vs @vntg.co.kr)
  if (!found && localPart) {
    found = employees.find((e) => {
      const empEmail = getEmailFromEmployee(e)
      const emp = (empEmail ?? '').toLowerCase().trim()
      return emp.startsWith(localPart + '@') || emp === localPart
    })
  }

  return found ? getDeptFromEmployee(found) : null
}

/**
 * 조직도 목록 조회 (세아웍스 departments API)
 * 향후 칭찬 챌린지 동료 검색 등에 활용
 */
export async function fetchDepartments(): Promise<SeahDepartment[] | null> {
  const url = process.env.SEAH_ORGSYNC_ORG_API_URL?.trim()
  const auth = getBasicAuthHeader()
  if (!url || !auth) return null

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify(REQUEST_BODY),
    })

    if (!res.ok) {
      console.error('[SeahOrgsync] departments API 실패:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
    return Array.isArray(list) ? list : null
  } catch (err) {
    console.error('[SeahOrgsync] fetchDepartments 에러:', err)
    return null
  }
}
