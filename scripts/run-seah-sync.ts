/**
 * 세아웍스 스냅샷 수동 동기화
 * 사용: npm run sync:seah
 */
import { createClient } from '@supabase/supabase-js'
import { runSeahOrgsyncSnapshot } from '@/lib/seah-sync-snapshot'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SERVER_SUPABASE_PUBLIC_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
    process.exit(1)
  }

  const admin = createClient(url, key)
  const result = await runSeahOrgsyncSnapshot(admin)

  console.log(JSON.stringify(result, null, 2))

  if (result.jobTitleSkipped) {
    console.warn('\n⚠️  job_title 컬럼이 없어 직책 없이 저장했습니다.')
    console.warn('   Supabase에서 docs/migrations/046-seah-employees-job-title.sql 실행 후 다시 sync:seah 하세요.')
  }

  process.exit(result.success ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
