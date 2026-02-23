import Link from 'next/link'
import { Gift, Heart, ClipboardList, Target, ChevronRight, Users } from 'lucide-react'
import { getCurrentUser } from '@/api/actions/auth'
import { getUsersForAdmin, getSiteContentForAdmin, getAdminDashboardStats, getDonationAmountsByPeriod } from '@/api/actions/admin'
import { getDonationTargetsForAdmin } from '@/api/actions/admin/donation-targets'
import { formatPoints } from '@/lib/formatPoints'
import { GrantPointsForm } from './components/GrantPointsForm'
import { SiteContentForm } from './components/SiteContentForm'
import { ResetTestDataButton } from './components/ResetTestDataButton'
import { UserDeptEdit } from './components/UserDeptEdit'
import { AdminToggle } from './components/AdminToggle'

export default async function AdminPage() {
  const user = await getCurrentUser()
  const { data: users, error: usersError } = await getUsersForAdmin()
  const userList = users ?? []
  const siteContent = await getSiteContentForAdmin()
  const dashboardStats = await getAdminDashboardStats()
  const { data: donationTargets } = await getDonationTargetsForAdmin()
  const targets = donationTargets ?? []
  const periodAmounts = await getDonationAmountsByPeriod()
  const currentUserId = user?.user_id ?? ''

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
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md"
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
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Target className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500">목표 달성률</p>
            <p className="text-xl font-bold tabular-nums text-gray-900">
              {dashboardStats.error ? '—' : `${dashboardStats.progress.toFixed(1)}%`}
            </p>
            {!dashboardStats.error && dashboardStats.totalTarget > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">
                목표 {formatPoints(dashboardStats.totalTarget)} · 완료 {dashboardStats.completedCount}개
              </p>
            )}
          </div>
        </div>
        <Link
          href="/admin/verifications"
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md"
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

      {/* MAU: 별도 섹션 · 시각화 */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-gray-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <Users className="size-5" />
          </span>
          월간 활성 사용자 (MAU)
        </h2>
        <p className="mb-5 text-sm text-gray-500">최근 30일 동안 한 번이라도 접속한 사용자 수입니다. 목표: 전 직원의 80% 이상이 월 1회 이상 접속.</p>
        {dashboardStats.mau != null ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-baseline gap-4 gap-y-1">
              <span className="text-4xl font-bold tabular-nums text-violet-600">
                {dashboardStats.mau}명
              </span>
              <span className="text-lg text-gray-500">
                / 전체 {userList.length}명
              </span>
              {userList.length > 0 && (
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-medium text-violet-700">
                  {((dashboardStats.mau / userList.length) * 100).toFixed(1)}%
                </span>
              )}
            </div>
            {userList.length > 0 && (Math.ceil(userList.length * 0.8) > 0) && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-gray-500">목표 달성률 (80% 목표)</span>
                    <span className="tabular-nums text-gray-700">
                      {Math.min(100, (dashboardStats.mau / (userList.length * 0.8)) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (dashboardStats.mau / (userList.length * 0.8)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    목표 {Math.ceil(userList.length * 0.8)}명 이상 접속 시 달성
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 py-8 text-center">
            <Users className="mx-auto size-10 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-500">준비 중</p>
            <p className="mt-0.5 text-xs text-gray-400">
              마이그레이션 <code className="rounded bg-gray-200 px-1">016-users-last-active-at.sql</code> 실행 후 표시됩니다.
            </p>
          </div>
        )}
      </section>

      {/* 기부 현황 요약 (기부처별 달성률 그래프) */}
      {targets.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-gray-900">기부 현황 요약</h2>
          <div className="space-y-4">
            {targets.map((t) => {
              const pct = t.target_amount > 0 ? Math.min(100, (t.current_amount / t.target_amount) * 100) : 0
              const isDone = t.status === 'COMPLETED'
              return (
                <div key={t.target_id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
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
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700"
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
        <h2 className="mb-3 text-base font-bold text-gray-900">바로가기</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/admin/events"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md"
          >
            <span className="text-lg font-bold text-gray-900">이벤트</span>
            <span className="mt-1 text-sm text-gray-500">이벤트·챌린지 등록 및 목록 관리</span>
            <span className="mt-3 text-sm font-medium text-green-600">이동 →</span>
          </Link>
          <Link
            href="/admin/verifications"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md"
          >
            <span className="text-lg font-bold text-gray-900">인증 심사</span>
            <span className="mt-1 text-sm text-gray-500">참여 인증 승인·반려, 일괄 처리</span>
            <span className="mt-3 text-sm font-medium text-green-600">이동 →</span>
          </Link>
          <Link
            href="/admin/donation-targets"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md"
          >
            <span className="text-lg font-bold text-gray-900">기부처</span>
            <span className="mt-1 text-sm text-gray-500">목표 수정, 오프라인 성금 합산</span>
            <span className="mt-3 text-sm font-medium text-green-600">이동 →</span>
          </Link>
        </div>
      </section>

      {/* 설정·운영 */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-gray-900">설정 · 운영</h2>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-2 font-bold text-gray-900">메인 화면 문구</h3>
          <p className="mb-4 text-sm text-gray-500">
            히어로 영역 시즌 뱃지·타이틀·부제목. 줄바꿈은 <code className="rounded bg-gray-100 px-1">\n</code> 입력.
          </p>
          <SiteContentForm initial={siteContent} />
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
          <h3 className="mb-2 font-bold text-gray-900">테스트 데이터 초기화</h3>
          <p className="mb-4 text-sm text-gray-600">
            포인트·기부 내역 초기화 후 테스트용 데이터로 채웁니다.
          </p>
          <ResetTestDataButton />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-bold text-gray-900">포인트 지급</h3>
          {usersError && <p className="mb-4 text-sm text-red-600">{usersError}</p>}
          <GrantPointsForm users={userList} />
          {userList.length === 0 && (
            <p className="mt-3 text-sm text-amber-700">
              사용자 목록이 비어 있으면 메인에서 <strong>로그인</strong> 한 번 해 주세요.
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h3 className="font-bold text-gray-900">관리자 계정</h3>
            <p className="mt-1 text-sm text-gray-500">
              체크를 켜면 해당 사용자가 관리자 페이지 접근·이벤트 관리가 가능합니다.
            </p>
          </div>
          {userList.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              등록된 사용자가 없습니다. 메인에서 로그인하면 여기에서 관리자를 지정할 수 있습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">이름 / 이메일</th>
                    <th className="px-6 py-3 font-medium">부서</th>
                    <th className="px-6 py-3 font-medium">관리자</th>
                    <th className="px-6 py-3 font-medium text-right">보유 P</th>
                    <th className="px-6 py-3 font-medium text-right">누적 기부</th>
                    <th className="px-6 py-3 font-medium">등급</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {userList.map((u) => (
                    <tr key={u.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{u.name || '—'}</span>
                        <span className="block text-xs text-gray-500">{u.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <UserDeptEdit userId={u.user_id} initialDeptName={u.dept_name} />
                      </td>
                      <td className="px-6 py-4">
                        <AdminToggle
                          userId={u.user_id}
                          initial={!!u.is_admin}
                          isSelf={u.user_id === currentUserId}
                        />
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        {u.current_points.toLocaleString()} P
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {u.total_donated_amount.toLocaleString()} P
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            u.level === 'EARTH_HERO'
                              ? 'bg-purple-100 text-purple-700'
                              : u.level === 'GREEN_MASTER'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {u.level === 'EARTH_HERO' ? 'Earth Hero' : u.level === 'GREEN_MASTER' ? 'Green Master' : 'Eco Keeper'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
