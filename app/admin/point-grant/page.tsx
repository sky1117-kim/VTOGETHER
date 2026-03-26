import Link from 'next/link'
import { getUsersForAdmin } from '@/api/actions/admin'
import { GrantPointsForm } from '../components/GrantPointsForm'
import { AdminPageHeader } from '../components/AdminPageHeader'

/** 관리자 전용: 이벤트 외에 직원에게 V.Credit(C)을 수동으로 넣는 화면 */
export default async function AdminPointGrantPage() {
  const { data: users, error: usersError } = await getUsersForAdmin()
  const userList = users ?? []

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="V.Credit 수동 지급"
        description="이벤트 심사와 별개로, 보정·특별 보상 등 필요 시 직원 계정에 C를 직접 적립합니다. 내역은 포인트 거래에「관리자 지급」또는 입력한 사유로 남습니다."
        breadcrumbs={[
          { label: '관리자', href: '/admin' },
          { label: 'V.Credit 수동 지급' },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
          <strong>팁:</strong> 사유란에 &quot;○○ 이벤트 누락 보정&quot;처럼 적어 두면 나중에 엑셀·감사 때 구분하기 쉽습니다. 비우면「관리자 지급」으로만 기록됩니다.
        </p>
        {usersError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            사용자 목록 조회 실패: {usersError}
          </div>
        )}
        <GrantPointsForm users={userList} />
        {userList.length === 0 && !usersError && (
          <p className="mt-4 text-sm text-amber-700">
            사용자가 없습니다. 한 명이라도 메인에서 로그인한 뒤 다시 열어주세요.
          </p>
        )}
      </div>

      <p className="text-center text-sm text-gray-500">
        <Link
          href="/admin"
          className="font-medium text-green-600 hover:text-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded"
        >
          ← 대시보드로
        </Link>
      </p>
    </div>
  )
}
