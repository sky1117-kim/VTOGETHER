import { getCurrentUser } from '@/api/actions/auth'
import { getMatchingAmountByTarget } from '@/api/actions/admin'
import { getTotalDonationStats, getDonationTargets } from '@/api/queries/donation'
import { getSiteContent } from '@/api/queries/siteContent'
import { getPopupNotices } from '@/api/queries/notices'
import {
  getPersonalRankingQuarterly,
  getTeamRankingQuarterly,
  getCurrentQuarterBounds,
} from '@/api/queries/ranking'
import { getEventsWithRoundsForPublic } from '@/api/queries/events'
import {
  getActiveHealthChallengeDefinitions,
  getHealthChallengeSubmittedTrackInfosForSeason,
} from '@/api/queries/health-challenges'
import { DashboardSection } from '@/components/main/DashboardSection'
import { DonationSection } from '@/components/main/DonationSection'
import { PopupNotice } from '@/components/main/PopupNotice'
import { CampaignsSection, type HealthChallengeBundle } from '@/components/main/CampaignsSection'
import { SalaryDonationSection } from '@/components/main/SalaryDonationSection'
import { HonorsSection } from '@/components/main/HonorsSection'

type PageProps = { searchParams: Promise<{ admin?: string }> }

export default async function HomePage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  const params = await searchParams
  const showAdminDenied = params?.admin === 'denied'

  let stats = { totalTarget: 40000000, totalCurrent: 0, completedCount: 0, progress: 0 }
  let targets: Awaited<ReturnType<typeof getDonationTargets>> = []
  let siteContent: Awaited<ReturnType<typeof getSiteContent>> = {}
  let personalRank: Awaited<ReturnType<typeof getPersonalRankingQuarterly>> = []
  let teamRank: Awaited<ReturnType<typeof getTeamRankingQuarterly>> = []
  let events: Awaited<ReturnType<typeof getEventsWithRoundsForPublic>> = []
  let healthChallengesByEventId: Record<string, HealthChallengeBundle> = {}
  let popupNotices: Awaited<ReturnType<typeof getPopupNotices>> = []

  try {
    const [statsRes, targetsRes, contentRes, personalRes, teamRes, eventsRes, matchingByTarget, popupRes] = await Promise.all([
      getTotalDonationStats(),
      getDonationTargets(),
      getSiteContent(),
      getPersonalRankingQuarterly(10),
      getTeamRankingQuarterly(10),
      getEventsWithRoundsForPublic(user?.id ?? null),
      getMatchingAmountByTarget(),
      getPopupNotices(user?.id ?? null),
    ])
    const totalMatching = Object.values(matchingByTarget).reduce((sum, v) => sum + v, 0)
    stats = { ...statsRes, totalCurrent: statsRes.totalCurrent + totalMatching }
    targets = (targetsRes ?? []).map((t) => {
      const effectiveAmount = t.current_amount + (matchingByTarget[t.target_id] ?? 0)
      return {
        ...t,
        current_amount: effectiveAmount,
        status: (effectiveAmount >= t.target_amount ? 'COMPLETED' : t.status) as 'ACTIVE' | 'COMPLETED',
      }
    })
    siteContent = contentRes
    personalRank = personalRes
    teamRank = teamRes
    events = eventsRes ?? []
    popupNotices = popupRes
  } catch {
    // DB 미설정 시 기본값 유지
  }

  // 건강 챌린지: 5·6월 등 ACTIVE 시즌이 여러 개일 수 있음
  try {
    const healthDefs = await getActiveHealthChallengeDefinitions()
    for (const def of healthDefs.definitions) {
      const eventId = def.season.event_id
      if (!eventId) continue
      const submittedTrackInfos = await getHealthChallengeSubmittedTrackInfosForSeason(
        user?.id ?? null,
        def.season.season_id,
      )
      healthChallengesByEventId[eventId] = {
        season: def.season,
        tracks: def.tracks,
        submittedTrackIds: submittedTrackInfos.map((x) => x.track_id),
        submittedTrackInfos,
      }
    }
  } catch {
    // ignore
  }

  const displayName = user ? user.name || user.email : '게스트'
  const currentPoints = user?.current_points ?? 0
  const currentMedals = user?.current_medals ?? 0
  const totalDonated = user?.total_donated_amount ?? 0
  const level = user?.level ?? 'ECO_KEEPER'

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-3 pb-12 pt-0 sm:px-6 lg:px-8">
      {popupNotices.length > 0 && (
        <PopupNotice notices={popupNotices} userId={user?.id ?? null} />
      )}
      {showAdminDenied && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          관리자 페이지는 관리자 계정으로만 접근할 수 있습니다. 관리자 권한이 필요하면 기존 관리자에게 문의하세요.
        </div>
      )}
      <div className="animate-fade-up">
        <DashboardSection
          displayName={displayName}
          currentPoints={currentPoints}
          currentMedals={currentMedals}
          totalDonated={totalDonated}
          level={level}
          email={user?.email}
          deptName={user?.dept_name}
          heroSeasonBadge={siteContent.hero_season_badge}
          heroTitle={siteContent.hero_title}
          heroSubtitle={siteContent.hero_subtitle}
        />
      </div>
      <div className="animate-fade-up mt-8">
        <DonationSection
          totalTarget={stats.totalTarget}
          totalCurrent={stats.totalCurrent}
          targets={targets}
          userPoints={currentPoints}
        />
      </div>
      <div className="animate-fade-up mt-8">
        <CampaignsSection
          events={events}
          isLoggedIn={!!user}
          healthChallengesByEventId={healthChallengesByEventId}
        />
      </div>
      <div className="animate-fade-up mt-8">
        <SalaryDonationSection />
      </div>
      <div className="animate-fade-up mt-8">
        <HonorsSection
          personalRank={personalRank}
          teamRank={teamRank}
          quarterLabel={getCurrentQuarterBounds().label}
        />
      </div>
    </div>
  )
}
