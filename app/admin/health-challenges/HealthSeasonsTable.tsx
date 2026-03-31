'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  updateHealthSeasonStatus,
  refillDefaultTracksForSeason,
  type HealthSeasonAdminRow,
} from '@/api/actions/admin/health-challenges'

function fmtSeoul(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      dateStyle: 'medium',
    })
  } catch {
    return iso
  }
}

export function HealthSeasonsTable({ seasons }: { seasons: HealthSeasonAdminRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function onStatus(seasonId: string, status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED') {
    if (!confirm(`상태를 ${status}(으)로 바꿀까요?`)) return
    setBusyId(seasonId)
    const r = await updateHealthSeasonStatus(seasonId, status)
    setBusyId(null)
    if (!r.success) alert(r.error)
    else router.refresh()
  }

  async function onRefill(seasonId: string) {
    if (!confirm('기본 4종목·레벨 목표를 다시 채웁니다. 기존 값은 upsert로 맞춥니다. 계속할까요?')) return
    setBusyId(seasonId)
    const r = await refillDefaultTracksForSeason(seasonId)
    setBusyId(null)
    if (!r.success) alert(r.error)
    else router.refresh()
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">시즌 목록</h2>
      <div className="overflow-x-auto">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">연결 이벤트</th>
              <th className="px-3 py-2">슬러그</th>
              <th className="px-3 py-2">기간 (서울)</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {seasons.map((s) => (
              <tr key={s.season_id}>
                <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                <td className="px-3 py-2 text-gray-600">
                  {s.event_id ? (
                    <Link
                      href={`/admin/events/${s.event_id}`}
                      className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                    >
                      이벤트 열기
                    </Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">{s.slug}</td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {fmtSeoul(s.starts_at)} ~ {fmtSeoul(s.ends_at)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      s.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : s.status === 'DRAFT'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <select
                      disabled={busyId === s.season_id}
                      value={s.status}
                      onChange={(e) =>
                        onStatus(s.season_id, e.target.value as 'DRAFT' | 'ACTIVE' | 'ARCHIVED')
                      }
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                    <button
                      type="button"
                      disabled={busyId === s.season_id}
                      onClick={() => onRefill(s.season_id)}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      종목·레벨 채우기
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
