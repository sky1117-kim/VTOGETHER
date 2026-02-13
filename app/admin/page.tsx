import Link from 'next/link'
import { getUsersForAdmin, getSiteContentForAdmin } from '@/api/actions/admin'
import { GrantPointsForm } from './components/GrantPointsForm'
import { SiteContentForm } from './components/SiteContentForm'
import { ResetTestDataButton } from './components/ResetTestDataButton'
import { UserDeptEdit } from './components/UserDeptEdit'

export default async function AdminPage() {
  const { data: users, error: usersError } = await getUsersForAdmin()
  const userList = users ?? []
  const siteContent = await getSiteContentForAdmin()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">관리자 대시보드</h2>
        <p className="mt-1 text-gray-500">
          포인트 지급 후 메인에서 로그인하여 기부 기능을 테스트할 수 있습니다.
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          사용자 목록이 비어 있으면, 먼저 메인 화면에서 <strong>로그인</strong>을 한 번 진행해 주세요. (Google 로그인 시 자동 등록)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            전사 누적 기부금
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">—</p>
          <p className="text-xs text-gray-400">준비 중</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            목표 달성률
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">—</p>
          <p className="text-xs text-gray-400">준비 중</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            등록 사용자
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{userList.length}명</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            승인 대기
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">—</p>
          <p className="text-xs text-gray-400">준비 중</p>
        </div>
      </div>

      {/* 메인 화면 문구 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-gray-900">메인 화면 문구</h3>
        <p className="mb-4 text-sm text-gray-500">
          메인 상단 히어로 영역의 시즌 뱃지·타이틀·부제목을 수정할 수 있습니다. 줄바꿈은 입력란에 <code className="rounded bg-gray-100 px-1">\n</code> 으로 넣으세요.
        </p>
        <SiteContentForm initial={siteContent} />
      </div>

      {/* 테스트 데이터 초기화 */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-gray-900">테스트 데이터 초기화</h3>
        <p className="mb-4 text-sm text-gray-600">
          포인트·기부 내역을 비우고, 테스트 유저·기부처 진행률을 넣어 포인트 사용(기부) 및 실시간 랭킹을 확인할 수 있습니다.
        </p>
        <ResetTestDataButton />
      </div>

      {/* 포인트 지급 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-gray-900">포인트 지급 (기부 테스트용)</h3>
        {usersError && (
          <p className="mb-4 text-sm text-red-600">{usersError}</p>
        )}
        <GrantPointsForm users={userList} />
      </div>

      {/* 사용자 목록 */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">사용자 목록</h3>
          <p className="text-sm text-gray-500">Google 로그인 시 자동 등록됩니다.</p>
        </div>
        {userList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            등록된 사용자가 없습니다. 메인에서 로그인하면 여기에서 포인트를 지급할 수 있습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">이름 / 이메일</th>
                  <th className="px-6 py-3 font-medium">부서</th>
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

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900">추가 예정 (Phase 2)</h3>
        <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
          <li>이벤트/챌린지 등록 (CMS)</li>
          <li>인증 심사 센터 (일괄 승인/반려)</li>
          <li>기부처 목표 수정 및 오프라인 합산</li>
        </ul>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700"
        >
          메인으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
