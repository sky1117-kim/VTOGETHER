import Link from 'next/link'
import { Gift, Heart, ClipboardList, Target, ChevronRight, Sparkles } from 'lucide-react'
import { getCurrentUser } from '@/api/actions/auth'
import { getUsersForAdmin, getSiteContentForAdmin, getAdminDashboardStats, getDonationAmountsByPeriod, getEventEarnedStats } from '@/api/actions/admin'
import { getDonationTargetsForAdmin } from '@/api/actions/admin/donation-targets'
import { formatPoints } from '@/lib/formatPoints'
import { TARGET_DISPLAY_NAMES } from '@/constants/donationTargets'
import { SiteContentForm } from './components/SiteContentForm'
import { ResetTestDataButton } from './components/ResetTestDataButton'
import { AdminUserTable } from './components/AdminUserTable'
import { AdminSection } from './components/AdminSection'
import { DonationByTargetPie } from './components/DonationByTargetPie'
import { UserLevelPie } from './components/UserLevelPie'
import { DonationPeriodPie } from './components/DonationPeriodPie'
import { MauDonutChart } from './components/MauDonutChart'

function formatMedals(n: number): string {
  if (n >= 100_000_000) {
    const eok = n / 100_000_000
    return (eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(1)) + '억 M'
  }
  if (n >= 10_000) {
    const man = n / 10_000
    return (man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)) + '만 M'
  }
  return n.toLocaleString() + ' M'
}

export default async function AdminPage() {
  const user = await getCurrentUser()
  const { data: users, error: usersError } = await getUsersForAdmin()
  const userList = users ?? []
  const siteContent = await getSiteContentForAdmin()
  const dashboardStats = await getAdminDashboardStats()
  const { data: donationTargets } = await getDonationTargetsForAdmin()
  const targets = donationTargets ?? []
  const periodAmounts = await getDonationAmountsByPeriod()
  const eventEarnedStats = await getEventEarnedStats()
  const currentUserId = user?.user_id ?? ''

  // 등급별 사용자 수 (시각화용) — Eco Keeper, Green Master, Earth Hero 항상 3가지 표시
  const levelLabels: Record<string, string> = {
    ECO_KEEPER: 'Eco Keeper',
    GREEN_MASTER: 'Green Master',
    EARTH_HERO: 'Earth Hero',
  }
  const levelCounts = userList.reduce<Record<string, number>>((acc, u) => {
    const label = levelLabels[u.level] ?? u.level ?? 'Eco Keeper'
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {})
  const levelDistribution = (['Eco Keeper', 'Green Master', 'Earth Hero'] as const).map((name) => ({
    name,
    value: levelCounts[name] ?? 0,
  }))

  // 기부처별 기부 금액 — 홈과 동일한 표기(국제구조위원회, 대한적십자사 등)로 전부 표시
  const donationByTargetAll = targets.map((t) => ({
    name: TARGET_DISPLAY_NAMES[t.name] ?? t.name,
    value: t.current_amount,
  }))

  // 접속 기간별 사용자 수 (MAU 카드용, last_active_at 기준)
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoIso = weekAgo.toISOString()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString()
  const activeToday = userList.filter((u) => (u.last_active_at ?? '') >= todayStart).length
  const activeThisWeek = userList.filter((u) => (u.last_active_at ?? '') >= weekAgoIso).length

  return (
    <div className="space-y-8">
      {/* 알림 */}
      {usersError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          사용자 목록 조회 실패: {usersError}
          {usersError.includes('is_admin') && (
            <span className="mt-2 block">
              → Supabase에서 <code className="rounded bg-red-100 px-1">006-1-add-admin-column.sql</code> 실행 후 다시 시도하세요.
            </span>
          )}
        </div>
      )}

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="mt-1 text-sm text-gray-500">전사 지표와 자주 쓰는 메뉴를 한눈에 확인하세요.</p>
      </div>

      {/* 지표: 이벤트·기부·달성률·승인대기 (첫 줄 4개) */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/events"
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600">
            <Gift className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500">진행 중인 이벤트</p>
            <p className="text-xl font-bold tabular-nums text-gray-900">
              {dashboardStats.activeEventsCount}개
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-gray-400" />
        </Link>
        <Link
          href="/admin/donation-targets"
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Heart className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500">전사 누적 기부</p>
            <p className="text-xl font-bold tabular-nums text-gray-900">
              {dashboardStats.error ? '—' : formatPoints(dashboardStats.totalCurrent)}
            </p>
            {dashboardStats.error && <p className="mt-0.5 text-xs text-red-500">{dashboardStats.error}</p>}
          </div>
          <ChevronRight className="size-5 shrink-0 text-gray-400" />
        </Link>
        <Link
          href="/admin/donation-targets"
          className="flex min-h-[124px] items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-6 shadow-sm transition hover:border-green-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Target className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500">목표 달성률</p>
            <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-gray-900">
              {dashboardStats.error ? '—' : `${dashboardStats.progress.toFixed(1)}%`}
            </p>
            {!dashboardStats.error && dashboardStats.totalTarget > 0 && (
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                목표 {formatPoints(dashboardStats.totalTarget)} · 완료 {dashboardStats.completedCount}개
              </p>
            )}
          </div>
          <ChevronRight className="size-5 shrink-0 text-gray-400" />
        </Link>
        <Link
          href="/admin/verifications"
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <ClipboardList className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500">승인 대기</p>
            <p className="text-xl font-bold tabular-nums text-gray-900">
              {dashboardStats.pendingCount}건
            </p>
            {dashboardStats.pendingCount > 0 && (
              <p className="mt-0.5 text-xs font-medium text-green-600">인증 심사 하기 →</p>
            )}
          </div>
          <ChevronRight className="size-5 shrink-0 text-gray-400" />
        </Link>
      </section>

      {/* 이벤트 적립 현황: People/Culture 및 매칭 */}
      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-emerald-900">이벤트 적립 현황</h3>
            <p className="mt-1 text-xs text-emerald-700/90">
              People은 V.Medal, Culture는 V.Credit 기준으로 집계합니다. 매칭금은 Medal 전환 Credit 기부분만 반영합니다.
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-emerald-600 shadow-sm">
            <Sparkles className="size-4.5" />
          </div>
        </div>
        <div className="p-5">
        {eventEarnedStats.error ? (
          <p className="text-sm text-red-500">{eventEarnedStats.error}</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-semibold text-slate-600">People V.Medal</dt>
              <dd className="mt-1.5 text-2xl font-black tabular-nums tracking-tight text-slate-900">
                {formatMedals(eventEarnedStats.peopleMedalEarned)}
              </dd>
              <p className="mt-1 text-[11px] text-slate-500">People 이벤트 기본 보상</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-semibold text-slate-600">Culture V.Credit</dt>
              <dd className="mt-1.5 text-2xl font-black tabular-nums tracking-tight text-slate-900">
                {formatPoints(eventEarnedStats.cultureCreditEarned)}
              </dd>
              <p className="mt-1 text-[11px] text-slate-500">Culture 이벤트 기본 보상</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <dt className="text-xs font-semibold text-amber-700">매칭금</dt>
              <dd className="mt-1.5 text-2xl font-black tabular-nums tracking-tight text-amber-800">
                {formatPoints(eventEarnedStats.matchingAmount)}
              </dd>
              <p className="mt-1 text-[11px] text-amber-700/90">Medal 전환 기부분과 동일</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <dt className="text-xs font-semibold text-emerald-700">전체 사용자 적립</dt>
              <dd className="mt-1.5 space-y-0.5 text-sm font-bold tabular-nums text-emerald-900">
                <p>{formatPoints(eventEarnedStats.totalCreditEarned)}</p>
                <p>{formatMedals(eventEarnedStats.totalMedalEarned)}</p>
              </dd>
              <p className="mt-1 text-[11px] text-emerald-700/80">V.Credit + V.Medal</p>
            </div>
            <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 sm:col-span-2 lg:col-span-4">
              <dt className="text-xs font-bold tracking-wide text-emerald-800">전체 모인금액</dt>
              <dd className="mt-1.5 text-3xl font-black tabular-nums tracking-tight text-emerald-900">
                {formatPoints(eventEarnedStats.totalCollected)}
              </dd>
              <p className="mt-1 text-xs font-medium text-emerald-700">이벤트 Credit + 매칭금 (기부 가능 재원)</p>
            </div>
          </dl>
        )}
        </div>
      </section>

      {/* 차트: MAU · 기부처별 · 기간별 · 등급별 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* MAU */}
        <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">월간 활성 사용자 (MAU)</h3>
          {dashboardStats.mau != null && userList.length > 0 ? (
            <>
              <MauDonutChart mau={dashboardStats.mau} total={userList.length} />
              <dl className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs">
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 text-gray-600">
                  <span>최근 30일</span>
                  <span className="whitespace-nowrap text-right font-medium tabular-nums text-gray-900">{dashboardStats.mau}명</span>
                </div>
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 text-gray-600">
                  <span>이번 주</span>
                  <span className="whitespace-nowrap text-right font-medium tabular-nums text-gray-900">{activeThisWeek}명</span>
                </div>
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 text-gray-600">
                  <span>오늘</span>
                  <span className="whitespace-nowrap text-right font-medium tabular-nums text-gray-900">{activeToday}명</span>
                </div>
              </dl>
            </>
          ) : dashboardStats.mau == null ? (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 text-center text-xs text-gray-500">
              마이그레이션 016 실행 후 표시
            </div>
          ) : (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 text-xs text-gray-500">
              데이터 없음
            </div>
          )}
        </div>
        {/* 기부처별 기부 비율 */}
        <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">기부처별 기부 비율</h3>
          {donationByTargetAll.length > 0 ? (
            <DonationByTargetPie data={donationByTargetAll} />
          ) : (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 text-xs text-gray-500">
              데이터 없음
            </div>
          )}
        </div>
        {/* 이번 달 기부 시기별 */}
        <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">이번 달 기부 시기별</h3>
          {periodAmounts.thisMonth > 0 ? (
            <DonationPeriodPie
              data={{
                today: periodAmounts.today,
                thisWeek: periodAmounts.thisWeek,
                thisMonth: periodAmounts.thisMonth,
              }}
            />
          ) : (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 text-xs text-gray-500">
              데이터 없음
            </div>
          )}
        </div>
        {/* 등급별 사용자 */}
        <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">등급별 사용자</h3>
          {levelDistribution.length > 0 ? (
            <UserLevelPie data={levelDistribution} />
          ) : (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 text-xs text-gray-500">
              데이터 없음
            </div>
          )}
        </div>
      </section>

      {/* 기부 현황 요약 (기부처별 달성률 그래프) */}
      {targets.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-gray-900">기부 현황 요약</h2>
          <div className="space-y-4">
            {targets.map((t) => {
              const displayName = TARGET_DISPLAY_NAMES[t.name] ?? t.name
              const pct = t.target_amount > 0 ? Math.min(100, (t.current_amount / t.target_amount) * 100) : 0
              const isDone = t.status === 'COMPLETED'
              return (
                <div key={t.target_id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800">{displayName}</span>
                    <span className="shrink-0 text-xs tabular-nums text-gray-500">
                      {formatPoints(t.current_amount)} / {formatPoints(t.target_amount)}
                      {isDone && <span className="ml-1 text-green-600">완료</span>}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isDone ? 'bg-green-500' : 'bg-green-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <Link
            href="/admin/donation-targets"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded btn-press-link"
          >
            기부처 관리
            <ChevronRight className="size-4" />
          </Link>
        </section>
      )}

      {/* 기간별 기부 (오늘 / 이번 주 / 이번 달) 시각화 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-gray-900">기간별 기부 금액</h2>
        {periodAmounts.error ? (
          <p className="text-sm text-red-600">{periodAmounts.error}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="text-xs font-medium text-gray-500">오늘</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                  {formatPoints(periodAmounts.today)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="text-xs font-medium text-gray-500">이번 주</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                  {formatPoints(periodAmounts.thisWeek)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="text-xs font-medium text-gray-500">이번 달</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                  {formatPoints(periodAmounts.thisMonth)}
                </p>
              </div>
            </div>
            {/* 막대 비교: 이번 달 기준 상대 비율 */}
            {periodAmounts.thisMonth > 0 && (
              <div className="mt-5 space-y-3">
                <p className="text-xs font-medium text-gray-500">비교</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-gray-600">오늘</span>
                    <div className="h-6 min-w-[40px] flex-1 overflow-hidden rounded-lg bg-gray-100">
                      <div
                        className="h-full rounded-lg bg-green-400"
                        style={{
                          width: `${Math.min(100, (periodAmounts.today / periodAmounts.thisMonth) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-gray-600">
                      {formatPoints(periodAmounts.today)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-gray-600">이번 주</span>
                    <div className="h-6 min-w-[40px] flex-1 overflow-hidden rounded-lg bg-gray-100">
                      <div
                        className="h-full rounded-lg bg-green-500"
                        style={{
                          width: `${Math.min(100, (periodAmounts.thisWeek / periodAmounts.thisMonth) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-gray-600">
                      {formatPoints(periodAmounts.thisWeek)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-gray-600">이번 달</span>
                    <div className="h-6 min-w-[40px] flex-1 overflow-hidden rounded-lg bg-gray-100">
                      <div className="h-full w-full rounded-lg bg-green-600" />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-gray-600">
                      {formatPoints(periodAmounts.thisMonth)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 바로가기 */}
      <section>
        <h2 className="mb-4 text-base font-bold text-gray-900">바로가기</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <a
            href="#admin-settings"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
          >
            <span className="text-lg font-bold text-gray-900">설정 · 운영</span>
            <span className="mt-1 text-sm text-gray-500">메인 문구, 수동 지급 안내, 관리자 설정</span>
            <span className="mt-3 text-sm font-medium text-green-600">열기 →</span>
          </a>
          <Link
            href="/admin/events"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
          >
            <span className="text-lg font-bold text-gray-900">이벤트</span>
            <span className="mt-1 text-sm text-gray-500">이벤트·챌린지 등록 및 목록 관리</span>
            <span className="mt-3 text-sm font-medium text-green-600">이동 →</span>
          </Link>
          <Link
            href="/admin/verifications"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
          >
            <span className="text-lg font-bold text-gray-900">인증 심사</span>
            <span className="mt-1 text-sm text-gray-500">참여 인증 승인·반려, 일괄 처리</span>
            <span className="mt-3 text-sm font-medium text-green-600">이동 →</span>
          </Link>
          <Link
            href="/admin/donation-targets"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
          >
            <span className="text-lg font-bold text-gray-900">기부처</span>
            <span className="mt-1 text-sm text-gray-500">목표 수정, 오프라인 성금 합산</span>
            <span className="mt-3 text-sm font-medium text-green-600">이동 →</span>
          </Link>
          <Link
            href="/admin/point-grant"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
          >
            <span className="text-lg font-bold text-gray-900">지급/적립 내역</span>
            <span className="mt-1 text-sm text-gray-500">수동 지급 + 직원 거래 내역 통합 조회</span>
            <span className="mt-3 text-sm font-medium text-green-600">이동 →</span>
          </Link>
        </div>
      </section>

      {/* 설정·운영: 접기/펼치기로 화면 정리 */}
      <AdminSection
        id="admin-settings"
        title="설정 · 운영"
        description="메인 문구, 지급/적립 내역, 관리자 설정, 테스트 데이터"
        defaultOpen={false}
      >
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 font-bold text-gray-900">메인 화면 문구</h3>
            <p className="mb-4 text-sm text-gray-500">
              히어로 영역 시즌 뱃지·타이틀·부제목. 줄바꿈은 <code className="rounded bg-gray-100 px-1">\n</code> 입력.
            </p>
            <SiteContentForm initial={siteContent} />
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="mb-2 font-bold text-gray-900">지급/적립 내역</h3>
            <p className="mb-4 text-sm text-gray-500">
              직원에게 C를 직접 넣는 수동 지급과, 직원 전체의 지급/적립/사용 거래 내역 조회를 같은 페이지에서 처리합니다.
            </p>
            <Link
              href="/admin/point-grant"
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 btn-press"
            >
              지급/적립 내역 페이지 열기
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
              <h3 className="font-bold text-gray-900">관리자 계정</h3>
              <p className="mt-1 text-sm text-gray-500">
                체크를 켜면 해당 사용자가 관리자 페이지 접근·이벤트 관리가 가능합니다.
              </p>
            </div>
            <div className="p-4 sm:p-6">
              <AdminUserTable users={userList} currentUserId={currentUserId} />
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6">
            <h3 className="mb-2 font-bold text-gray-900">테스트 데이터 초기화</h3>
            <p className="mb-4 text-sm text-gray-600">
              포인트·기부 내역 초기화 후 테스트용 데이터로 채웁니다.
            </p>
            <ResetTestDataButton />
          </div>
        </div>
      </AdminSection>
    </div>
  )
}
