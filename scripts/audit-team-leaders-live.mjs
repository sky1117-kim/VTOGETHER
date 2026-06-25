/**
 * 세아웍스 API 스냅샷 기준 부서별 팀장 여부 (DB job_title 없어도 동작)
 * 사용: node --env-file=.env scripts/audit-team-leaders-live.mjs
 */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// ts lib를 직접 import하기 어려우므로 필드 추출 로직 인라인
function getEmail(row) {
  const e = row.email ?? row.mail ?? row.userEmail ?? row.emp_email
  return typeof e === 'string' ? e.trim().toLowerCase() : null
}
function getJobTitle(row) {
  const keys = [
    'job_duty_code', 'jobDutyCode',
    'job_title', 'jobTitle', 'position', 'position_name', 'positionName',
    'duty_name', 'dutyName', 'title_name', 'titleName', 'jikchak_name',
    'grade_name', 'pos_name',
  ]
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}
function getOrgCode(row) {
  const c = row.org_code ?? row.orgCode
  return typeof c === 'string' && c.trim() ? c.trim() : null
}
function getOrgName(row) {
  const n = row.org_code_name ?? row.orgCodeName ?? row.dept_name ?? row.org_name
  return typeof n === 'string' && n.trim() ? n.trim() : null
}
function getName(row) {
  return typeof row.name === 'string' ? row.name.trim() : null
}
function isTeamLeader(title) {
  return !!title && title.includes('팀장')
}

const username = process.env.SEAH_ORGSYNC_USERNAME?.trim()
const password = process.env.SEAH_ORGSYNC_PASSWORD?.trim()
const userUrl = process.env.SEAH_ORGSYNC_USER_API_URL?.trim()
if (!username || !password || !userUrl) {
  console.error('SEAH_ORGSYNC_* 환경변수가 필요합니다.')
  process.exit(1)
}

const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
const res = await fetch(userUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: auth },
  body: JSON.stringify({ system_id: 'VTOGETHER', company_code: ['ORG_Seah'] }),
  signal: AbortSignal.timeout(30000),
})

if (!res.ok) {
  console.error('세아웍스 API 실패:', res.status, await res.text())
  process.exit(1)
}

const raw = await res.json()
function extractList(data) {
  if (Array.isArray(data)) return data
  const o = data && typeof data === 'object' ? data : {}
  const dataNode = o.DATA ?? o.data
  for (const k of ['list', 'items', 'result', 'employeeList', 'employees']) {
    if (Array.isArray(dataNode?.[k])) return dataNode[k]
    if (Array.isArray(o[k])) return o[k]
  }
  return []
}

const list = extractList(raw).filter((e) => {
  const s = e.status_code ?? e.statusCode
  return s !== 'N' && s !== 'n'
})

if (!list.length) {
  console.log('재직 직원 0명 또는 응답 파싱 실패')
  if (list.length === 0 && raw) {
    const sample = list[0] ?? extractList(raw)[0]
    console.log('첫 레코드 키:', sample ? Object.keys(sample) : Object.keys(raw))
  }
  process.exit(0)
}

const firstKeys = Object.keys(list[0] ?? {})
const withTitle = list.filter((e) => getJobTitle(e))
console.log(`재직 직원 ${list.length}명 | 직책 필드 추출 성공 ${withTitle.length}명`)
console.log('API 첫 레코드 키:', firstKeys.join(', '))
if (withTitle[0]) {
  console.log('직책 샘플:', [...new Set(withTitle.slice(0, 30).map(getJobTitle))].slice(0, 15).join(' | '))
}
console.log('')

const byOrg = new Map()
const noOrg = []

for (const row of list) {
  const code = getOrgCode(row)
  const item = {
    email: getEmail(row),
    name: getName(row),
    org_code: code,
    org_name: getOrgName(row),
    job_title: getJobTitle(row),
  }
  if (!code) {
    noOrg.push(item)
    continue
  }
  if (!byOrg.has(code)) byOrg.set(code, { org_name: item.org_name, members: [] })
  byOrg.get(code).members.push(item)
}

const withoutLeader = []
const withLeader = []

for (const [code, { org_name, members }] of byOrg) {
  const leaders = members.filter((m) => isTeamLeader(m.job_title))
  const row = {
    org_code: code,
    org_name: org_name ?? '(부서명 없음)',
    headcount: members.length,
    leaders,
    job_title_filled: members.filter((m) => m.job_title).length,
    sample: members.slice(0, 4).map((m) => `${m.name ?? '?'}[${m.job_title ?? '직책없음'}]`),
  }
  if (leaders.length) withLeader.push(row)
  else withoutLeader.push(row)
}

withoutLeader.sort((a, b) => a.org_name.localeCompare(b.org_name, 'ko'))

console.log('=== 팀장 없는 부서 (API 기준, 직책에 「팀장」 없음) ===')
console.log(`부서 수: ${byOrg.size} | 팀장 있음: ${withLeader.length} | 팀장 없음: ${withoutLeader.length}\n`)

for (const r of withoutLeader) {
  console.log(`• ${r.org_name} (${r.org_code})`)
  console.log(`  인원 ${r.headcount} | 직책 데이터 ${r.job_title_filled}명`)
  console.log(`  ${r.sample.join(' / ')}`)
  console.log('')
}

if (noOrg.length) {
  console.log(`--- org_code 없음: ${noOrg.length}명 ---`)
  noOrg.slice(0, 10).forEach((m) => console.log(`  ${m.name} <${m.email}>`))
}

if (withTitle.length === 0) {
  console.log('\n⚠️ API 응답에서 직책 필드를 찾지 못했습니다. 정의서의 직책 필드명을 확인해야 합니다.')
}
