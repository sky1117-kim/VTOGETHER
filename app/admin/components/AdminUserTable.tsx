'use client'

import { useMemo, useState } from 'react'
import type { UserRow } from '@/api/actions/admin'
import { AdminToggle } from './AdminToggle'
import { Search, Users } from 'lucide-react'

interface AdminUserTableProps {
  users: UserRow[]
  currentUserId: string
  /** true일 때 "최근 접속" 컬럼 표시 */
  showLastActiveAt?: boolean
}

/** last_active_at을 "n분 전", "n시간 전" 등으로 표시 */
function formatLastActive(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** 관리자 계정 테이블: 이름/이메일 검색, 부서 필터 */
export function AdminUserTable({ users, currentUserId, showLastActiveAt }: AdminUserTableProps) {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<string>('')

  // 부서 목록 (중복 제거, 정렬)
  const deptOptions = useMemo(() => {
    const set = new Set<string>()
    users.forEach((u) => set.add((u.dept_name?.trim() || '미지정')))
    return ['', ...Array.from(set).sort((a, b) => (a === '미지정' ? 1 : a.localeCompare(b)))]
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const matchSearch =
        !q ||
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
      const dept = u.dept_name?.trim() || '미지정'
      const matchDept = !deptFilter || dept === deptFilter
      return matchSearch && matchDept
    })
  }, [users, search, deptFilter])

  return (
    <div className="space-y-4">
      {/* 검색·필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색"
            className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20"
            aria-label="이름 또는 이메일로 검색"
          />
        </div>
        <div className="flex items-center gap-2">
          <Users className="size-4 text-gray-400" aria-hidden />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-700 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            aria-label="부서로 필터"
          >
            <option value="">전체 부서</option>
            {deptOptions.filter(Boolean).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-500">
          {filtered.length}명 / {users.length}명
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">이름 / 이메일</th>
                {showLastActiveAt && (
                  <th className="whitespace-nowrap px-6 py-3 font-medium">최근 접속</th>
                )}
                <th className="whitespace-nowrap px-6 py-3 font-medium">부서</th>
                <th className="whitespace-nowrap px-6 py-3 font-medium">관리자</th>
                <th className="whitespace-nowrap px-6 py-3 font-medium text-right">보유 P</th>
                <th className="whitespace-nowrap px-6 py-3 font-medium text-right">누적 기부</th>
                <th className="whitespace-nowrap px-6 py-3 font-medium">등급</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr
                  key={u.user_id}
                  className="transition-colors hover:bg-gray-50 focus-within:bg-gray-50 focus-within:ring-2 focus-within:ring-green-500/30 focus-within:ring-inset"
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{u.name || '—'}</span>
                    <span className="block text-xs text-gray-500">{u.email}</span>
                  </td>
                  {showLastActiveAt && (
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {formatLastActive(u.last_active_at)}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                    {u.dept_name?.trim() || '미지정'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <AdminToggle
                      userId={u.user_id}
                      initial={!!u.is_admin}
                      isSelf={u.user_id === currentUserId}
                    />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right font-bold text-gray-900">
                    {u.current_points.toLocaleString()} P
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-gray-600">
                    {u.total_donated_amount.toLocaleString()} P
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${
                        u.level === 'EARTH_HERO'
                          ? 'bg-purple-100 text-purple-700'
                          : u.level === 'GREEN_MASTER'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {u.level === 'EARTH_HERO'
                        ? 'Earth Hero'
                        : u.level === 'GREEN_MASTER'
                          ? 'Green Master'
                          : 'Eco Keeper'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-500">
            {users.length === 0
              ? '등록된 사용자가 없습니다. 메인에서 로그인하면 여기에서 관리자를 지정할 수 있습니다.'
              : '검색·필터 조건에 맞는 사용자가 없습니다.'}
          </div>
        )}
      </div>
    </div>
  )
}
