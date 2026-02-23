import Link from 'next/link'
import { TrendingUp, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LevelRoadmapModal } from '@/components/my/LevelRoadmapModal'
type Level = 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'

const LEVEL_INFO: Record<Level, { label: string; icon: string; next: Level | null; nextMin: number }> = {
  ECO_KEEPER: { label: 'Eco Keeper', icon: '🌱', next: 'GREEN_MASTER', nextMin: 50001 },   // 새싹
  GREEN_MASTER: { label: 'Green Master', icon: '🌳', next: 'EARTH_HERO', nextMin: 100001 }, // 나무
  EARTH_HERO: { label: 'Earth Hero', icon: '🌍', next: null, nextMin: 0 },                  // 지구
}

/** My Status 카드 상단(헤더) 그라데이션·장식 색 + "등급 상세 보기" 링크 색 — 등급별 */
const LEVEL_HEADER_STYLE: Record<
  Level,
  { gradient: string; blurOrb1: string; blurOrb2: string; avatarBg: string; detailLink: string }
> = {
  ECO_KEEPER: {
    gradient: 'bg-gradient-to-br from-slate-400 via-slate-600 to-indigo-800',
    blurOrb1: 'bg-white/10',
    blurOrb2: 'bg-slate-500/20',
    avatarBg: 'bg-slate-800',
    detailLink: 'text-slate-600 hover:text-slate-800',
  },
  GREEN_MASTER: {
    gradient: 'bg-gradient-to-br from-emerald-500 via-green-600 to-teal-600',
    blurOrb1: 'bg-white/10',
    blurOrb2: 'bg-emerald-400/30',
    avatarBg: 'bg-green-900',
    detailLink: 'text-green-600 hover:text-green-800',
  },
  EARTH_HERO: {
    gradient: 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700',
    blurOrb1: 'bg-white/10',
    blurOrb2: 'bg-violet-400/25',
    avatarBg: 'bg-violet-900',
    detailLink: 'text-violet-600 hover:text-violet-800',
  },
}

function getNextLevelProgress(level: Level, totalDonated: number) {
  const info = LEVEL_INFO[level]
  if (!info.next) return null
  const nextInfo = LEVEL_INFO[info.next]
  const remaining = Math.max(0, info.nextMin - totalDonated)
  const currentLevelMin = level === 'ECO_KEEPER' ? 10000 : level === 'GREEN_MASTER' ? 50001 : 100001
  const range = info.nextMin - currentLevelMin
  const currentInRange = totalDonated - currentLevelMin
  const percent = range > 0 ? Math.min(100, Math.round((currentInRange / range) * 100)) : 0
  return { nextLabel: nextInfo.label, remaining, percent, currentLevelMin, nextMin: info.nextMin }
}

interface DashboardSectionProps {
  displayName: string
  currentPoints: number
  totalDonated: number
  /** DB에서 오는 값이 다를 수 있어 내부에서 ECO_KEEPER 등 세 가지로 보정함 */
  level?: string | null
  /** 계정 정보 (부서, 이메일) - 로그인 시 표시 */
  email?: string | null
  deptName?: string | null
  heroSeasonBadge?: string
  heroTitle?: string
  heroSubtitle?: string
}

const defaultHero = {
  seasonBadge: '2026 Season 1',
  title: '나의 활동이\n세상의 기회가 되도록',
  subtitle: '획득한 V.Point로 기부하고\n나의 ESG Level을 올려보세요!',
}

/** DB/API에서 오는 값이 다를 수 있어서, 표시용 level을 세 가지 중 하나로 보정 */
const VALID_LEVELS: Level[] = ['ECO_KEEPER', 'GREEN_MASTER', 'EARTH_HERO']
function normalizeLevel(level: string | null | undefined): Level {
  if (level && VALID_LEVELS.includes(level as Level)) return level as Level
  return 'ECO_KEEPER'
}

export function DashboardSection({
  displayName,
  currentPoints,
  totalDonated,
  level: levelProp,
  email = null,
  deptName = null,
  heroSeasonBadge = defaultHero.seasonBadge,
  heroTitle = defaultHero.title,
  heroSubtitle = defaultHero.subtitle,
}: DashboardSectionProps) {
  const level = normalizeLevel(levelProp)
  const safeTitle = heroTitle ?? defaultHero.title
  const safeSubtitle = heroSubtitle ?? defaultHero.subtitle
  const titleLines = safeTitle.split('\n')
  const subtitleLines = safeSubtitle.split('\n')
  const levelInfo = LEVEL_INFO[level]
  const nextProgress = getNextLevelProgress(level, totalDonated)
  const headerStyle = LEVEL_HEADER_STYLE[level]

  return (
    <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="card-hover hero-glass relative flex min-h-[280px] overflow-hidden rounded-3xl p-10 text-white shadow-soft-xl lg:min-h-[320px] lg:col-span-2 lg:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800" aria-hidden />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,transparent_50%)]" aria-hidden />
        <div className="relative z-10 flex flex-col justify-center">
          <span className="mb-5 inline-block w-fit rounded-full border border-green-400/40 bg-green-500/25 px-4 py-1.5 text-xs font-bold tracking-wide text-green-200">
            {heroSeasonBadge ?? defaultHero.seasonBadge}
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

      {/* My Status 카드: 컴팩트 배치 (헤더 · 포인트 · 등급) */}
      <div className="card-hover w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-lg">
        {/* Header: 등급별 그라데이션 + 아바타·이름·부서·이메일 */}
        <div className={`relative ${headerStyle.gradient} px-4 py-4 pb-14`}>
          <div className={`absolute -mr-24 -mt-24 size-48 rounded-full ${headerStyle.blurOrb1} blur-3xl`} aria-hidden />
          <div className={`absolute -ml-20 -mb-20 size-40 rounded-full ${headerStyle.blurOrb2} blur-2xl`} aria-hidden />
          <div className="relative flex items-center gap-3">
            <Avatar className="size-14 shrink-0 border-2 border-white/50 shadow-lg">
              <AvatarFallback className={`${headerStyle.avatarBg} text-lg font-bold text-white`}>
                {displayName?.slice(0, 1) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-2xl">
                {displayName}
              </h2>
              <p className="mt-0.5 truncate text-xs text-white/80 drop-shadow-sm">
                {deptName?.trim() || '부서.'} · {email || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Available Points: 헤더와 살짝 겹침 */}
        <div className="relative -mt-9 mx-4">
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                  Available Points
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900 sm:text-3xl">
                    {currentPoints.toLocaleString()}
                  </span>
                  <span className="text-base font-semibold text-green-600">P</span>
                </div>
              </div>
              <Link
                href="/my"
                className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-600 transition hover:bg-green-50 hover:text-green-700"
              >
                내역
              </Link>
            </div>
          </div>
        </div>

        {/* Membership Level: 등급 + 진행률 (간격 축소) */}
        <div className="p-4 pt-5">
          <LevelRoadmapModal level={level} totalDonated={totalDonated}>
            <div
              className={`cursor-pointer rounded-xl border px-4 py-4 transition hover:opacity-90 ${
                level === 'EARTH_HERO'
                  ? 'border-violet-200 bg-violet-50/80'
                  : level === 'GREEN_MASTER'
                    ? 'border-emerald-200 bg-emerald-50/80'
                    : 'border-slate-200 bg-slate-50/80'
              }`}
            >
              <div className="mb-3 flex items-center gap-3">
                {/* 등급 이모지: 동그라미, 흰 배경 + 경계선 같은 색 */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white">
                  <span className="text-2xl leading-none">{levelInfo.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`text-lg font-black tracking-tight sm:text-xl level-label-status ${
                        level === 'EARTH_HERO'
                          ? 'level-label-status-hero'
                          : level === 'GREEN_MASTER'
                            ? 'level-label-status-master'
                            : 'level-label-status-eco'
                      }`}
                    >
                      {levelInfo.label.toUpperCase()}
                    </h3>
                    <span className={`flex shrink-0 items-center gap-0.5 text-xs font-semibold transition-colors ${headerStyle.detailLink}`}>
                      등급 상세 보기
                      <ChevronRight className="size-3.5" />
                    </span>
                  </div>
                </div>
              </div>
              {nextProgress ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="size-3.5 text-gray-500" />
                      <span className="font-semibold text-gray-600">Next Tier</span>
                      <span
                        className={`font-bold ${level === 'ECO_KEEPER' ? 'text-slate-600' : 'text-green-600'}`}
                      >
                        {nextProgress.nextLabel}
                      </span>
                    </div>
                    <span className="font-medium text-gray-500">{nextProgress.remaining.toLocaleString()}P 남음</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-300">
                    {nextProgress.percent > 0 && (
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          level === 'ECO_KEEPER'
                            ? 'bg-gradient-to-r from-slate-500 to-indigo-500'
                            : 'bg-gradient-to-r from-green-500 to-teal-500'
                        }`}
                        style={{ width: `${nextProgress.percent}%` }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>{totalDonated.toLocaleString()}P</span>
                    <span>{nextProgress.nextMin.toLocaleString()}P</span>
                  </div>
                </div>
              ) : (
                /* EARTH HERO 등 최고 등급: 진행률 대신 "최고 등급 달성" 표시 */
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-violet-600">최고 등급 달성</span>
                    <span className="font-medium text-gray-500">100%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-300">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-500">
                    누적 기부 <span className="font-semibold text-gray-700">{totalDonated.toLocaleString()}P</span>
                  </div>
                </div>
              )}
            </div>
          </LevelRoadmapModal>
        </div>
      </div>

    </section>
  )
}
