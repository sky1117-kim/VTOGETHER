/**
 * 부서(org_code)별 팀장(직책에 「팀장」) 존재 여부 감사
 * 사용: node --env-file=.env scripts/audit-team-leaders.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SERVER_SUPABASE_PUBLIC_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}

const admin = createClient(url, key)

function isTeamLeader(title) {
  return typeof title === 'string' && title.trim().includes('팀장')
}

const { data: employees, error: empErr } = await admin
  .from('seah_employees')
  .select('email, name, org_code, job_title, status_code')
  .neq('status_code', 'N')

if (empErr) {
  console.error('seah_employees 조회 실패:', empErr.message)
  if (empErr.message?.includes('job_title')) {
    console.error('→ 046-seah-employees-job-title.sql 마이그레이션 후 세아웍스 동기화를 실행하세요.')
  }
  process.exit(1)
}

const { data: orgUnits } = await admin.from('seah_org_units').select('org_code, org_name, is_active')

const orgNameByCode = new Map((orgUnits ?? []).map((o) => [o.org_code, o.org_name]))

const byOrg = new Map()
for (const e of employees ?? []) {
  const code = e.org_code?.trim() || '(org_code 없음)'
  if (!byOrg.has(code)) byOrg.set(code, [])
  byOrg.get(code).push(e)
}

const withLeader = []
const withoutLeader = []
const noOrgCode = []

for (const [orgCode, members] of byOrg) {
  if (orgCode === '(org_code 없음)') {
    noOrgCode.push(...members)
    continue
  }
  const leaders = members.filter((m) => isTeamLeader(m.job_title))
  const withJobTitle = members.filter((m) => m.job_title?.trim())
  const row = {
    org_code: orgCode,
    org_name: orgNameByCode.get(orgCode) ?? '(조직명 없음)',
    headcount: members.length,
    leader_count: leaders.length,
    leaders: leaders.map((l) => `${l.name ?? '?'} <${l.email}> (${l.job_title})`),
    job_title_filled: withJobTitle.length,
    sample_members: members.slice(0, 3).map((m) => `${m.name ?? '?'} [${m.job_title ?? '직책없음'}]`),
  }
  if (leaders.length > 0) withLeader.push(row)
  else withoutLeader.push(row)
}

withoutLeader.sort((a, b) => a.org_name.localeCompare(b.org_name, 'ko'))
withLeader.sort((a, b) => a.org_name.localeCompare(b.org_name, 'ko'))

console.log('=== 팀장 감사 (seah_employees, 재직자, 직책에 「팀장」 포함) ===\n')
console.log(`총 부서( org_code ) 수: ${byOrg.size - (noOrgCode.length ? 1 : 0)}`)
console.log(`팀장 있음: ${withLeader.length}개 부서`)
console.log(`팀장 없음: ${withoutLeader.length}개 부서`)
console.log(`org_code 없는 직원: ${noOrgCode.length}명\n`)

if (withoutLeader.length === 0 && noOrgCode.length === 0) {
  console.log('팀장을 못 찾은 부서가 없습니다.')
} else {
  console.log('--- 팀장 없는 부서 ---')
  for (const r of withoutLeader) {
    console.log(`\n• ${r.org_name} (${r.org_code})`)
    console.log(`  재직 ${r.headcount}명 | job_title 채워진 인원 ${r.job_title_filled}명`)
    console.log(`  샘플: ${r.sample_members.join(' / ')}`)
  }
  if (noOrgCode.length) {
    console.log('\n--- org_code 없음 (팀장 CC 불가) ---')
    for (const m of noOrgCode.slice(0, 20)) {
      console.log(`  ${m.name ?? '?'} <${m.email}> job_title=${m.job_title ?? 'null'}`)
    }
    if (noOrgCode.length > 20) console.log(`  ... 외 ${noOrgCode.length - 20}명`)
  }
}

const allEmptyTitle = (employees ?? []).every((e) => !e.job_title?.trim())
if (allEmptyTitle && (employees ?? []).length > 0) {
  console.log('\n⚠️  모든 직원 job_title이 비어 있습니다. 세아웍스 동기화(직책 필드)를 먼저 실행하세요.')
}
