import { getCurrentUser } from '@/api/actions/auth'
import { getTotalDonationStats, getDonationTargets } from '@/api/queries/donation'
import { getSiteContent } from '@/api/queries/siteContent'
import { getPersonalRanking, getTeamRanking } from '@/api/queries/ranking'
import { DashboardSection } from '@/components/main/DashboardSection'
import { DonationSection } from '@/components/main/DonationSection'
import { CampaignsSection } from '@/components/main/CampaignsSection'
import { SalaryDonationSection } from '@/components/main/SalaryDonationSection'
import { HonorsSection } from '@/components/main/HonorsSection'

export default async function HomePage() {
  const user = await getCurrentUser()

  let stats = { totalTarget: 40000000, totalCurrent: 0, completedCount: 0, progress: 0 }
  let targets: Awaited<ReturnType<typeof getDonationTargets>> = []
  let siteContent: Awaited<ReturnType<typeof getSiteContent>> = {}
  let personalRank: Awaited<ReturnType<typeof getPersonalRanking>> = []
  let teamRank: Awaited<ReturnType<typeof getTeamRanking>> = []

  try {
    const [statsRes, targetsRes, contentRes, personalRes, teamRes] = await Promise.all([
      getTotalDonationStats(),
      getDonationTargets(),
      getSiteContent(),
      getPersonalRanking(10),
      getTeamRanking(10),
    ])
    stats = statsRes
    targets = targetsRes ?? []
    siteContent = contentRes
    personalRank = personalRes
    teamRank = teamRes
  } catch {
    // DB 미설정 시 기본값 유지
  }

  const displayName = user ? user.name || user.email : '게스트'
  const currentPoints = user?.current_points ?? 0
  const totalDonated = user?.total_donated_amount ?? 0
  const level = user?.level ?? 'ECO_KEEPER'

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-2 sm:px-6 lg:px-8">
      <div className="animate-fade-up">
        <DashboardSection
          displayName={displayName}
          currentPoints={currentPoints}
          totalDonated={totalDonated}
          level={level}
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
        <CampaignsSection />
      </div>
      <div className="animate-fade-up mt-8">
        <SalaryDonationSection />
      </div>
      <div className="animate-fade-up mt-8">
        <HonorsSection personalRank={personalRank} teamRank={teamRank} />
      </div>
    </div>
  )
}
