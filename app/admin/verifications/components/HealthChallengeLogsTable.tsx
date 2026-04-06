'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  approveHealthActivityLog,
  approveAllPendingHealthActivityLogsForUser,
  rejectAllPendingHealthActivityLogsForUser,
  rejectHealthActivityLog,
  type HealthActivityLogAdminRow,
} from '@/api/actions/admin/health-challenges'
import { achievedLevelFromTotal } from '@/lib/health-challenge-scoring'

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20'

type GroupedLogRow = {
  group_id: string
  log_ids: string[]
  activity_dates: string[]
  base: HealthActivityLogAdminRow
}

function buildGroupedRows(rows: HealthActivityLogAdminRow[]): GroupedLogRow[] {
  const groupedRows: GroupedLogRow[] = []
  const groupedRowIndexByKey = new Map<string, number>()
  for (const row of rows) {
    const metricKey = `${row.distance_km ?? ''}|${row.speed_kmh ?? ''}|${row.elevation_m ?? ''}`
    const photosKey = [...(row.photo_urls ?? [])].sort().join('|')
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
  return groupedRows
}

/** 활동일 문자열을 읽기 쉬운 한국어 형식으로 표시 */
function formatActivityDate(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function rollupUnit(metric: HealthActivityLogAdminRow['track_metric']) {
  return metric === 'DISTANCE_KM' ? 'km' : 'm'
}

/** 종목에 설정된 1회 최소 조건을 한 줄로 요약 */
function formatTrackMinimumLine(row: HealthActivityLogAdminRow): string {
  if (row.track_metric === 'DISTANCE_KM') {
    const d =
      row.min_distance_km != null
        ? `거리 ${row.min_distance_km}km 이상`
        : '거리 최소 제한 없음'
    const s =
      row.min_speed_kmh != null ? ` · 속도 ${row.min_speed_kmh}km/h 이상` : ''
    return d + s
  }
  return row.min_elevation_m != null
    ? `고도 ${row.min_elevation_m}m 이상`
    : '고도 최소 제한 없음'
}

function achievedLevelDisplay(level: number) {
  if (level <= 0) return '미달성 (L0)'
  return `L${level} 달성`
}

function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="relative max-h-[90vh] max-w-[90vw]">
        <img
          src={url}
          alt="인증 사진 원본"
          className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-1 -top-1 rounded-full bg-white/95 p-2 text-gray-700 shadow-lg transition hover:bg-white sm:-right-2 sm:-top-2"
          aria-label="닫기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}

export function HealthChallengeLogsTable({ rows }: { rows: HealthActivityLogAdminRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'PENDING' | 'ALL'>('PENDING')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [compactMode, setCompactMode] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const groupedRows = useMemo(() => buildGroupedRows(rows), [rows])

  const filteredGroups = useMemo(() => {
    if (filterStatus === 'ALL') return groupedRows
    return groupedRows.filter((g) => g.base.status === 'PENDING')
  }, [groupedRows, filterStatus])

  const firstPendingLogIdByUser = useMemo(() => {
    const m = new Map<string, string>()
    for (const group of groupedRows) {
      if (group.base.status !== 'PENDING') continue
      if (!m.has(group.base.user_id)) {
        m.set(group.base.user_id, group.group_id)
      }
    }
    return m
  }, [groupedRows])

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

  const pendingCount = groupedRows.filter((g) => g.base.status === 'PENDING').length

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          심사 대기 <span className="font-semibold text-gray-900">{pendingCount}</span>건
          {filterStatus === 'ALL' && (
            <span className="text-gray-400"> · 전체 {groupedRows.length}건 표시 중</span>
          )}
        </p>
        <div className="flex gap-2 rounded-xl border border-gray-200 bg-gray-50/80 p-1">
          <button
            type="button"
            onClick={() => setFilterStatus('PENDING')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filterStatus === 'PENDING'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            대기만
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filterStatus === 'ALL'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            전체 기록
          </button>
        </div>
        <div className="flex gap-2 rounded-xl border border-gray-200 bg-gray-50/80 p-1">
          <button
            type="button"
            onClick={() => setCompactMode(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              compactMode
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            압축 보기
          </button>
          <button
            type="button"
            onClick={() => setCompactMode(false)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              !compactMode
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            전체 펼침
          </button>
        </div>
      </div>

      {filteredGroups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
          <p className="text-sm font-medium text-gray-600">
            {filterStatus === 'PENDING' ? '심사 대기 중인 건강 챌린지 제출이 없습니다.' : '표시할 제출이 없습니다.'}
          </p>
        </div>
      )}

      <ul className="space-y-5">
        {filteredGroups.map((group) => {
          const row = group.base
          const isExpanded = !compactMode || expandedIds.has(group.group_id)
          const submittedAt = row.created_at
            ? new Date(row.created_at).toLocaleString('ko-KR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'

          return (
            <li
              key={group.group_id}
              className={`overflow-hidden rounded-2xl border shadow-sm ${
                row.status === 'PENDING'
                  ? 'border-amber-200/80 bg-white'
                  : 'border-gray-200 bg-gray-50/40 text-gray-700'
              }`}
            >
              <div className="space-y-4 p-4 sm:p-5">
                {/* 심사자가 빠르게 훑는 요약 헤더 */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          row.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-900'
                            : row.status === 'APPROVED'
                              ? 'bg-green-100 text-green-900'
                              : 'bg-red-50 text-red-800'
                        }`}
                      >
                        {row.status === 'PENDING' ? '대기' : row.status === 'APPROVED' ? '승인' : '반려'}
                      </span>
                      <h3 className="text-base font-bold text-gray-900">{row.track_title}</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{row.user_name ?? '이름 없음'}</span>
                      {row.user_email ? (
                        <>
                          <span className="hidden sm:inline"> · </span>
                          <span className="block break-all text-gray-500 sm:inline">{row.user_email}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500">
                      제출 {submittedAt} · 활동일 {group.activity_dates.length}일 · 사진 {row.photo_urls.length}장
                    </p>
                    <p className="text-xs text-gray-600">
                      {row.distance_km != null ? `거리 ${row.distance_km}km` : ''}
                      {row.speed_kmh != null ? ` · 속도 ${row.speed_kmh}km/h` : ''}
                      {row.elevation_m != null ? ` · 고도 ${row.elevation_m}m` : ''}
                    </p>
                    {(() => {
                      const th = [...row.level_thresholds].sort((a, b) => a.level - b.level)
                      const groupAdd = row.contributed_per_log * group.log_ids.length
                      const projectedTotal = row.rollup_approved_total + groupAdd
                      const levelNow = row.rollup_achieved_level
                      const levelAfter = achievedLevelFromTotal(projectedTotal, th)
                      const deltaLevel = Math.max(0, levelAfter - levelNow)
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 font-semibold text-gray-700">
                            현재 {levelNow <= 0 ? 'L0' : `L${levelNow}`}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-bold ${
                              deltaLevel > 0
                                ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'border border-gray-300 bg-white text-gray-700'
                            }`}
                          >
                            승인 시 {levelAfter <= 0 ? 'L0' : `L${levelAfter}`}
                          </span>
                          {deltaLevel > 0 ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                              +{deltaLevel}단계 지급
                            </span>
                          ) : null}
                        </div>
                      )
                    })()}
                  </div>
                  {compactMode && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(group.group_id)) next.delete(group.group_id)
                          else next.add(group.group_id)
                          return next
                        })
                      }
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {isExpanded ? '접기' : '자세히'}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
                    {/* 메타 · 수치 */}
                    <div className="min-w-0 flex-1 space-y-4">

                  {/* 종목 최소 기준 · 월 L1~L3 · 누적/승인 시 달성 (제출 화면에는 레벨 ‘선택’ 없음 → 월 합으로 자동 산정) */}
                  <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white p-4 shadow-sm">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90">
                          1회 인증 최소 조건
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{formatTrackMinimumLine(row)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90">
                          월 누적 목표 (레벨 기준)
                        </p>
                        {row.level_thresholds.length === 0 ? (
                          <p className="mt-1 text-sm text-gray-500">등록된 L1~L3 목표가 없습니다.</p>
                        ) : (
                          <ul className="mt-2 space-y-1.5 text-sm text-gray-800">
                            {[...row.level_thresholds]
                              .sort((a, b) => a.level - b.level)
                              .map((t) => (
                                <li key={t.level} className="tabular-nums">
                                  <span className="font-semibold text-gray-900">L{t.level}</span>
                                  <span className="text-gray-600">
                                    {' '}
                                    월 합계 {t.target_value}
                                    {rollupUnit(row.track_metric)} 이상
                                  </span>
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                      {(() => {
                        const th = [...row.level_thresholds].sort((a, b) => a.level - b.level)
                        const ym = group.activity_dates[0]
                        const ymLabel = ym
                          ? `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`
                          : '해당 연·월'
                        const groupAdd = row.contributed_per_log * group.log_ids.length
                        const projectedTotal = row.rollup_approved_total + groupAdd
                        const levelAfter = achievedLevelFromTotal(projectedTotal, th)
                        const deltaLevel = Math.max(0, levelAfter - row.rollup_achieved_level)
                        return (
                          <div className="rounded-lg border border-gray-200/80 bg-white/90 p-3">
                            <p className="text-xs font-semibold text-gray-600">{ymLabel} · 레벨 기준</p>
                            <p className="mt-2 text-sm text-gray-800">
                              <span className="font-semibold text-gray-900">현재 레벨</span>
                              <span className="text-gray-500">: </span>
                              <span className="font-semibold text-emerald-800">
                                {achievedLevelDisplay(row.rollup_achieved_level)}
                              </span>
                              <span className="ml-1 text-xs text-gray-500">
                                (이미 승인된 기록 기준)
                              </span>
                            </p>
                            {row.status === 'PENDING' && th.length > 0 ? (
                              <p className="mt-2 border-t border-gray-100 pt-2 text-sm text-gray-800">
                                <span className="font-semibold text-gray-900">이 묶음 승인 시 레벨</span>
                                <span className="text-gray-500">: </span>
                                <span
                                  className={
                                    levelAfter > row.rollup_achieved_level
                                      ? 'font-bold text-emerald-700'
                                      : 'font-semibold text-gray-900'
                                  }
                                >
                                  {achievedLevelDisplay(levelAfter)}
                                </span>
                                {deltaLevel > 0 ? (
                                  <span className="ml-1 text-xs font-medium text-emerald-600">
                                    +{deltaLevel}단계 지급
                                  </span>
                                ) : null}
                              </p>
                            ) : null}
                            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                              참여자가 L1~L3 중 하나를 고르지는 않습니다. 월 기준으로 계산된 현재 레벨과 승인 시 레벨만
                              보여줍니다.
                            </p>
                          </div>
                        )
                      })()}
                      {row.minimum_session_warnings.length > 0 ? (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                          <p className="text-xs font-bold text-amber-900">종목 최소 조건 대비 부족 (심사 참고)</p>
                          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-amber-950">
                            {row.minimum_session_warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">활동일</p>
                    <ul className="mt-2 space-y-1.5 text-sm font-medium text-gray-900">
                      {group.activity_dates.map((date) => (
                        <li key={date} className="tabular-nums">
                          {formatActivityDate(date)}
                        </li>
                      ))}
                    </ul>
                    {group.activity_dates.length > 1 && (
                      <p className="mt-2 text-xs text-gray-500">{group.activity_dates.length}일 묶음 제출</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">기록 수치</p>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                      {row.distance_km != null && (
                        <div>
                          <dt className="text-xs text-gray-500">거리</dt>
                          <dd className="text-lg font-semibold tabular-nums text-gray-900">
                            {row.distance_km} km
                          </dd>
                        </div>
                      )}
                      {row.speed_kmh != null && (
                        <div>
                          <dt className="text-xs text-gray-500">속도</dt>
                          <dd className="text-lg font-semibold tabular-nums text-gray-900">
                            {row.speed_kmh} km/h
                          </dd>
                        </div>
                      )}
                      {row.elevation_m != null && (
                        <div>
                          <dt className="text-xs text-gray-500">고도</dt>
                          <dd className="text-lg font-semibold tabular-nums text-gray-900">
                            {row.elevation_m} m
                          </dd>
                        </div>
                      )}
                      {row.distance_km == null && row.speed_kmh == null && row.elevation_m == null && (
                        <p className="text-sm text-gray-500">등록된 수치 없음</p>
                      )}
                    </dl>
                  </div>
                    </div>

                    {/* 사진 */}
                    <div className="w-full shrink-0 lg:max-w-md xl:max-w-lg">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">인증 사진</p>
                      {row.photo_urls.length === 0 ? (
                        <p className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                          첨부된 사진이 없습니다.
                        </p>
                      ) : (
                        <>
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                            {row.photo_urls.map((url, i) => (
                              <button
                                key={`${url}-${i}`}
                                type="button"
                                onClick={() => setLightboxUrl(url)}
                                className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm transition ring-offset-2 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-green-500"
                              >
                                <img
                                  src={url}
                                  alt={`인증 사진 ${i + 1}`}
                                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                    const el = e.currentTarget.nextElementSibling
                                    if (el instanceof HTMLElement) el.classList.remove('hidden')
                                  }}
                                />
                                <span className="hidden absolute inset-0 flex items-center justify-center bg-gray-100 px-2 text-center text-xs text-gray-500">
                                  불러오기 실패
                                </span>
                                <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100 sm:text-xs">
                                  크게 보기
                                </span>
                              </button>
                            ))}
                          </div>
                          <p className="mt-2 text-center text-xs text-gray-500">사진을 누르면 전체 화면으로 봅니다 · Esc로 닫기</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {row.status === 'PENDING' && (
                <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-4 sm:px-5">
                  <label className="sr-only" htmlFor={`reject-${group.group_id}`}>
                    반려 사유
                  </label>
                  <input
                    id={`reject-${group.group_id}`}
                    type="text"
                    placeholder="반려 사유 (선택)"
                    value={rejectReason[group.group_id] ?? ''}
                    onChange={(e) =>
                      setRejectReason((prev) => ({ ...prev, [group.group_id]: e.target.value }))
                    }
                    className={inputClass}
                  />
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      disabled={busyId === group.group_id || busyUserId === row.user_id}
                      onClick={() => onApprove(group)}
                      className="min-h-11 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      disabled={busyId === group.group_id || busyUserId === row.user_id}
                      onClick={() => onReject(group)}
                      className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      반려
                    </button>
                    {firstPendingLogIdByUser.get(row.user_id) === group.group_id && (
                      <>
                        <button
                          type="button"
                          disabled={busyUserId === row.user_id || !!busyId}
                          onClick={() => onApproveAllForUser(row.user_id)}
                          className="min-h-11 rounded-xl border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-800 transition hover:bg-green-100 disabled:opacity-50"
                        >
                          이 참여자 대기 전체 승인
                        </button>
                        <button
                          type="button"
                          disabled={busyUserId === row.user_id || !!busyId}
                          onClick={() => onRejectAllForUser(row.user_id, rejectReason[group.group_id])}
                          className="min-h-11 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          이 참여자 대기 전체 반려
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}
