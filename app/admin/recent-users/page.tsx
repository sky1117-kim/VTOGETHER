import { getCurrentUser } from '@/api/actions/auth'
import { getRecentActiveUsersForAdmin } from '@/api/actions/admin'
import { AdminUserTable } from '../components/AdminUserTable'
import { AdminPageHeader } from '../components/AdminPageHeader'

/** 관리자: 최근 접속한 사용자 목록 (last_active_at 기준) */
export default async function AdminRecentUsersPage() {
  const user = await getCurrentUser()
  const { data: users, error } = await getRecentActiveUsersForAdmin()
  const userList = users ?? []
  const currentUserId = user?.user_id ?? ''

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="최근 접속한 사용자"
        description="마지막 접속 시각 기준으로 정렬됩니다. 메인 페이지·마이페이지 접속 시마다 갱신됩니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '최근 접속 사용자' }]}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          사용자 목록 조회 실패: {error}
        </div>
      )}

      <AdminUserTable
        users={userList}
        currentUserId={currentUserId}
        showLastActiveAt
      />
    </div>
  )
}
