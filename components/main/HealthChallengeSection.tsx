import {
  getActiveHealthChallengeDefinition,
  getHealthChallengeUserProgress,
} from '@/api/queries/health-challenges'
import { HealthChallengePanel } from '@/components/main/HealthChallengePanel'

/** 활성 시즌·종목이 있을 때만 메인에 노출. `embedded`: 이벤트 & 챌린지 섹션 안에 넣을 때 상단 제목 톤 다운 */
export async function HealthChallengeSection({
  userId,
  embedded = false,
}: {
  userId: string | null
  embedded?: boolean
}) {
  // ESLint 규칙상 `try/catch` 안에서 JSX를 생성하지 않도록,
  // 데이터 fetch(에러 처리)만 try/catch로 감싸고 JSX는 바깥에서 반환합니다.
  let def: Awaited<ReturnType<typeof getActiveHealthChallengeDefinition>>
  try {
    def = await getActiveHealthChallengeDefinition()
  } catch {
    return null
  }

  if (def.error || !def.season || def.tracks.length === 0) return null

  let prog: Awaited<ReturnType<typeof getHealthChallengeUserProgress>>
  try {
    prog = await getHealthChallengeUserProgress(userId)
  } catch {
    return null
  }

  return (
    <HealthChallengePanel
      season={def.season}
      tracks={def.tracks}
      year={prog.year}
      month={prog.month}
      rollups={prog.rollups}
      pendingLogCount={prog.pendingLogCount}
      isLoggedIn={!!userId}
      embedded={embedded}
    />
  )
}
