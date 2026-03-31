'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveHealthActivityLog,
  approveAllPendingHealthActivityLogsForUser,
  rejectAllPendingHealthActivityLogsForUser,
  rejectHealthActivityLog,
  type HealthActivityLogAdminRow,
} from '@/api/actions/admin/health-challenges'

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500/20'

export function HealthChallengeLogsTable({ rows }: { rows: HealthActivityLogAdminRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  type GroupedLogRow = {
    group_id: string
    log_ids: string[]
    activity_dates: string[]
    base: HealthActivityLogAdminRow
  }

  const groupedRows: GroupedLogRow[] = []
  const groupedRowIndexByKey = new Map<string, number>()
  for (const row of rows) {
    const metricKey = `${row.distance_km ?? ''}|${row.speed_kmh ?? ''}|${row.elevation_m ?? ''}`
    const photosKey = [...(row.photo_urls ?? [])].sort().join('|')
    // 같은 제출에서 만들어진 다중 활동일 로그는 created_at이 동일하므로, 해당 기준으로 한 줄로 묶습니다.
    const groupKey = [
      row.user_id,
      row.track_id,
      row.status,
      row.created_at,
      metricKey,
      photosKey,
    ].join('::')
    const existingIndex = groupedRowIndexByKey.get(groupKey)
    if (existingIndex == null) {
      groupedRowIndexByKey.set(groupKey, groupedRows.length)
      groupedRows.push({
        group_id: row.log_id,
        log_ids: [row.log_id],
        activity_dates: [row.activity_date],
        base: row,
      })
      continue
    }
    const existing = groupedRows[existingIndex]
    existing.log_ids.push(row.log_id)
    if (!existing.activity_dates.includes(row.activity_date)) {
      existing.activity_dates.push(row.activity_date)
    }
  }

  for (const g of groupedRows) {
    g.activity_dates.sort()
  }

  const firstPendingLogIdByUser = new Map<string, string>()
  for (const group of groupedRows) {
    if (group.base.status !== 'PENDING') continue
    if (!firstPendingLogIdByUser.has(group.base.user_id)) {
      firstPendingLogIdByUser.set(group.base.user_id, group.group_id)
    }
  }

  async function onApprove(group: GroupedLogRow) {
    setBusyId(group.group_id)
    for (const logId of group.log_ids) {
      const r = await approveHealthActivityLog(logId)
      if (!r.success) {
        setBusyId(null)
        alert(r.error ?? '승인 실패')
        return
      }
    }
    setBusyId(null)
    router.refresh()
  }

  async function onReject(group: GroupedLogRow) {
    setBusyId(group.group_id)
    const reason = rejectReason[group.group_id]
    for (const logId of group.log_ids) {
      const r = await rejectHealthActivityLog(logId, reason)
      if (!r.success) {
        setBusyId(null)
        alert(r.error ?? '반려 실패')
        return
      }
    }
    setBusyId(null)
    router.refresh()
  }

  async function onApproveAllForUser(userId: string) {
    setBusyUserId(userId)
    const r = await approveAllPendingHealthActivityLogsForUser(userId)
    setBusyUserId(null)
    if (!r.success) {
      alert(r.error ?? '일괄 승인 실패')
      return
    }
    alert(`해당 사용자 대기건 ${r.approved}건을 승인했습니다.`)
    router.refresh()
  }

  async function onRejectAllForUser(userId: string, reason?: string) {
    setBusyUserId(userId)
    const r = await rejectAllPendingHealthActivityLogsForUser(userId, reason)
    setBusyUserId(null)
    if (!r.success) {
      alert(r.error ?? '일괄 반려 실패')
      return
    }
    alert(`해당 사용자 대기건 ${r.rejected}건을 반려했습니다.`)
    router.refresh()
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">종목</th>
            <th className="px-4 py-3">참여자</th>
            <th className="px-4 py-3">활동일</th>
            <th className="px-4 py-3">수치</th>
            <th className="px-4 py-3">사진</th>
            <th className="px-4 py-3">처리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {groupedRows.map((group) => {
            const row = group.base
            return (
            <tr key={group.group_id} className={row.status !== 'PENDING' ? 'bg-gray-50/50 text-gray-600' : ''}>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    row.status === 'PENDING'
                      ? 'bg-amber-100 text-amber-800'
                      : row.status === 'APPROVED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-50 text-red-700'
                  }`}
                >
                  {row.status === 'PENDING' ? '대기' : row.status === 'APPROVED' ? '승인' : '반려'}
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">{row.track_title}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{row.user_name ?? '—'}</div>
                <div className="text-xs text-gray-500">{row.user_email}</div>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-0.5">
                  {group.activity_dates.map((date) => (
                    <div key={date} className="whitespace-nowrap">{date}</div>
                  ))}
                </div>
                {group.activity_dates.length > 1 && (
                  <div className="mt-1 text-xs text-gray-500">{group.activity_dates.length}일 제출</div>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                {row.distance_km != null && <div>거리 {row.distance_km} km</div>}
                {row.speed_kmh != null && <div>속도 {row.speed_kmh} km/h</div>}
                {row.elevation_m != null && <div>고도 {row.elevation_m} m</div>}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {row.photo_urls.slice(0, 3).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                  {row.photo_urls.length > 3 && (
                    <span className="self-center text-xs text-gray-500">+{row.photo_urls.length - 3}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 align-top">
                {row.status === 'PENDING' ? (
                  <div className="flex min-w-[200px] flex-col gap-2">
                    <input
                      type="text"
                      placeholder="반려 사유 (선택)"
                      value={rejectReason[group.group_id] ?? ''}
                      onChange={(e) =>
                        setRejectReason((prev) => ({ ...prev, [group.group_id]: e.target.value }))
                      }
                      className={inputClass}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === group.group_id || busyUserId === row.user_id}
                        onClick={() => onApprove(group)}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        disabled={busyId === group.group_id || busyUserId === row.user_id}
                        onClick={() => onReject(group)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        반려
                      </button>
                      {firstPendingLogIdByUser.get(row.user_id) === group.group_id && (
                        <>
                          <button
                            type="button"
                            disabled={busyUserId === row.user_id || !!busyId}
                            onClick={() => onApproveAllForUser(row.user_id)}
                            className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            이 사람 대기 전체 승인
                          </button>
                          <button
                            type="button"
                            disabled={busyUserId === row.user_id || !!busyId}
                            onClick={() => onRejectAllForUser(row.user_id, rejectReason[group.group_id])}
                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            이 사람 대기 전체 반려
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  )
}
