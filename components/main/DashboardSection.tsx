import Link from 'next/link'
import { LevelRoadmapModal } from '@/components/my/LevelRoadmapModal'

interface DashboardSectionProps {
  displayName: string
  currentPoints: number
  totalDonated: number
  level: 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'
  heroSeasonBadge?: string
  heroTitle?: string
  heroSubtitle?: string
}

const defaultHero = {
  seasonBadge: '2026 Season 1',
  title: '나의 활동이\n세상의 기회가 되도록',
  subtitle: '획득한 V.Point로 기부하고\n나의 ESG Level을 올려보세요!',
}

export function DashboardSection({
  displayName,
  currentPoints,
  totalDonated,
  level,
  heroSeasonBadge = defaultHero.seasonBadge,
  heroTitle = defaultHero.title,
  heroSubtitle = defaultHero.subtitle,
}: DashboardSectionProps) {
  const titleLines = heroTitle.split('\n')
  const subtitleLines = heroSubtitle.split('\n')
  return (
    <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="card-hover hero-glass relative flex min-h-[280px] overflow-hidden rounded-3xl p-10 text-white shadow-soft-xl lg:min-h-[320px] lg:col-span-2 lg:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800" aria-hidden />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,transparent_50%)]" aria-hidden />
        <div className="relative z-10 flex flex-col justify-center">
          <span className="mb-5 inline-block w-fit rounded-full border border-green-400/40 bg-green-500/25 px-4 py-1.5 text-xs font-bold tracking-wide text-green-200">
            {heroSeasonBadge}
          </span>
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-5xl">
            {titleLines.length >= 2 ? (
              <>
                <span className="block text-white">{titleLines[0]}</span>
                <span className="mt-2 block bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {titleLines[1]}
                </span>
              </>
            ) : (
              <span className="block text-white">{titleLines[0]}</span>
            )}
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-gray-300">
            {subtitleLines.map((line, i) => (
              <span key={i}>{line}{i < subtitleLines.length - 1 && <br />}</span>
            ))}
          </p>
        </div>
        <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-green-600 opacity-25 mix-blend-overlay blur-3xl" aria-hidden />
      </div>

      <div className="card-hover glass relative flex flex-col justify-between overflow-hidden rounded-3xl p-7 shadow-soft lg:p-8">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
            My Status
          </p>
          <LevelRoadmapModal level={level} totalDonated={totalDonated}>
            <div
              className={`mb-5 flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition hover:opacity-90 ${
                level === 'EARTH_HERO'
                  ? 'border-violet-200 bg-violet-50/80'
                  : level === 'GREEN_MASTER'
                    ? 'border-emerald-200 bg-emerald-50/80'
                    : 'border-green-200 bg-green-50/80'
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${
                  level === 'EARTH_HERO'
                    ? 'bg-violet-100 text-violet-600'
                    : level === 'GREEN_MASTER'
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-green-100 text-green-600'
                }`}
              >
                {level === 'ECO_KEEPER' && '🌱'}
                {level === 'GREEN_MASTER' && '🌿'}
                {level === 'EARTH_HERO' && '🌳'}
              </span>
              <div className="min-w-0 flex-1">
                <span
                  className={`block text-xl font-bold tracking-tight sm:text-2xl ${
                    level === 'EARTH_HERO'
                      ? 'text-violet-800'
                      : level === 'GREEN_MASTER'
                        ? 'text-emerald-800'
                        : 'text-green-800'
                  }`}
                >
                  {level === 'ECO_KEEPER' && 'Eco Keeper'}
                  {level === 'GREEN_MASTER' && 'Green Master'}
                  {level === 'EARTH_HERO' && 'Earth Hero'}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-gray-500">
                  레벨 상세 보기 →
                </span>
              </div>
            </div>
          </LevelRoadmapModal>
          <div className="rounded-2xl bg-gray-100/80 p-4 shadow-soft">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                사용 가능 포인트
              </span>
              <Link
                href="/my"
                className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-xs font-medium text-gray-600 shadow-soft transition hover:bg-white hover:text-green-600"
              >
                내역
              </Link>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-gray-900">
                {currentPoints.toLocaleString()}
              </span>
              <span className="mb-1.5 text-sm text-gray-500">P</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
