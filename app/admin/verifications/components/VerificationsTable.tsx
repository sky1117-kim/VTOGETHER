'use client'
/* eslint-disable @next/next/no-img-element */

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { PendingSubmissionRow } from '@/api/actions/admin/verifications'
import {
  approveSubmission,
  rejectSubmission,
  bulkApproveSubmissionIds,
  bulkRejectSubmissionIds,
} from '@/api/actions/admin/verifications'

const METHOD_LABEL: Record<string, string> = {
  PHOTO: '사진',
  TEXT: '텍스트',
  VALUE: '숫자',
  PEER_SELECT: '동료 선택',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '승인대기',
  APPROVED: '승인',
  REJECTED: '반려',
}

type PeerRecipientLite = NonNullable<PendingSubmissionRow['peer_recipients']>[number]

/** PEER_SELECT 저장값에서 동료 user_id 목록 */
function peerIdsFromSelectRaw(rawValue: unknown): string[] {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const v = rawValue as { peer_user_ids?: unknown }
    if (Array.isArray(v.peer_user_ids)) {
      return v.peer_user_ids.filter((x): x is string => typeof x === 'string' && !!x.trim())
    }
  }
  if (Array.isArray(rawValue)) {
    return rawValue.filter((x): x is string => typeof x === 'string' && !!x.trim())
  }
  return []
}

/** 제출 JSON의 organization_name 또는, 동일 부서만 모인 경우 users.dept_name */
function resolvePeerSelectTeamLabel(
  rawValue: unknown,
  recipients: PeerRecipientLite[] | undefined,
  ids: string[]
): string | null {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const org = (rawValue as { organization_name?: unknown }).organization_name
    if (typeof org === 'string' && org.trim()) return org.trim()
  }
  if (ids.length <= 1 || !recipients?.length) return null
  const recMap = new Map(recipients.map((r) => [r.user_id, r]))
  const depts = new Set<string>()
  for (const id of ids) {
    const d = recMap.get(id)?.dept_name?.trim()
    if (d) depts.add(d)
  }
  if (depts.size === 1) return [...depts][0]!
  return null
}

/** 목록·카드용 한 줄 요약 */
function parsePeerSelectDisplay(
  rawValue: unknown,
  fallbackPeerName: string | null,
  row?: PendingSubmissionRow
): string {
  const ids = peerIdsFromSelectRaw(rawValue)
  const recipients = row?.peer_recipients
  const recMap = new Map((recipients ?? []).map((r) => [r.user_id, r]))
  const names = ids.map((id) => recMap.get(id)?.name?.trim() || null)
  const teamLabel = resolvePeerSelectTeamLabel(rawValue, recipients, ids)

  if (ids.length === 0) {
    return fallbackPeerName ?? '동료 선택됨'
  }
  if (ids.length === 1) {
    const n = names[0] || fallbackPeerName || '동료 선택됨'
    return teamLabel ? `${teamLabel} · ${n}` : n
  }
  const resolved = names.filter(Boolean) as string[]
  if (teamLabel) {
    if (resolved.length > 0 && resolved.length <= 5) {
      return `${teamLabel} · ${resolved.join(', ')}`
    }
    return `${teamLabel} · ${ids.length}명`
  }
  const base = resolved[0] || fallbackPeerName || '동료'
  return resolved.length > 1 ? `${base} 외 ${ids.length - 1}명` : base
}

/** 상세 모달: 팀(부서) 라벨 + 멤버 표시 줄 */
function buildPeerSelectModalBlock(
  rawValue: unknown,
  row: PendingSubmissionRow
): { teamLabel: string | null; memberLines: string[] } {
  const ids = peerIdsFromSelectRaw(rawValue)
  const recipients = row.peer_recipients ?? []
  const recMap = new Map(recipients.map((r) => [r.user_id, r]))
  const teamLabel = resolvePeerSelectTeamLabel(rawValue, recipients, ids)

  const memberLines =
    ids.length > 0
      ? ids.map((id) => {
          const r = recMap.get(id)
          if (r) {
            return [r.name || '이름 없음', r.dept_name, r.email].filter(Boolean).join(' · ')
          }
          return `사용자 ID ${id.slice(0, 8)}… (프로필 조회 없음)`
        })
      : [row.peer_name ?? '동료 선택됨']

  return { teamLabel, memberLines }
}

/** 테이블·카드 헤더용: 칭찬 대상이 팀 단위면 팀명·인원, 다중이면 '첫 이름 외 n명' */
function formatPeerHeaderSummary(row: PendingSubmissionRow): string | null {
  const vd = row.verification_data ?? {}
  const methods = row.verification_methods ?? []
  let raw: unknown = null
  for (const m of methods) {
    if (m.method_type === 'PEER_SELECT') {
      raw = vd[m.method_id]
      break
    }
  }
  const ids = peerIdsFromSelectRaw(raw)
  const pr = row.peer_recipients ?? []
  if (ids.length === 0) {
    return row.peer_name ?? null
  }
  const teamLabel = resolvePeerSelectTeamLabel(raw, pr.length > 0 ? pr : undefined, ids)
  if (ids.length > 1 && teamLabel) {
    return `${teamLabel} (${ids.length}명)`
  }
  if (ids.length > 1) {
    const recMap = new Map(pr.map((r) => [r.user_id, r]))
    const first = recMap.get(ids[0]!)?.name ?? row.peer_name ?? '동료'
    return `${first} 외 ${ids.length - 1}명`
  }
  return pr[0]?.name ?? row.peer_name ?? null
}

interface VerificationsTableProps {
  rows: PendingSubmissionRow[]
}

export function VerificationsTable({ rows }: VerificationsTableProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ ids: string[]; isBulk: boolean } | null>(null)
  const [filterEventId, setFilterEventId] = useState<string>('')
  const [filterRoundId, setFilterRoundId] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('PENDING') // 기본: 승인대기만 보기 (자주 쓰는 작업)
  const [searchQuery, setSearchQuery] = useState<string>('')

  const eventOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rows) {
      if (!seen.has(r.event_id)) seen.set(r.event_id, r.event_title)
    }
    return Array.from(seen.entries()).map(([id, title]) => ({ event_id: id, event_title: title }))
  }, [rows])

  const roundOptions = useMemo(() => {
    if (!filterEventId) return []
    const list = rows
      .filter((r) => r.event_id === filterEventId && r.round_id != null)
      .map((r) => ({ round_id: r.round_id!, round_number: r.round_number! }))
    const seen = new Map<string, number>()
    for (const { round_id, round_number } of list) {
      if (!seen.has(round_id)) seen.set(round_id, round_number)
    }
    return Array.from(seen.entries())
      .map(([round_id, round_number]) => ({ round_id, round_number }))
      .sort((a, b) => a.round_number - b.round_number)
  }, [rows, filterEventId])

  const filteredRows = useMemo(() => {
    let list = rows
    if (filterEventId) list = list.filter((r) => r.event_id === filterEventId)
    if (filterRoundId) list = list.filter((r) => r.round_id === filterRoundId)
    if (filterStatus) list = list.filter((r) => r.status === filterStatus)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((r) => {
        const inRecipients = (r.peer_recipients ?? []).some(
          (p) =>
            (p.name ?? '').toLowerCase().includes(q) ||
            (p.dept_name ?? '').toLowerCase().includes(q) ||
            (p.email ?? '').toLowerCase().includes(q)
        )
        return (
          (r.user_name ?? '').toLowerCase().includes(q) ||
          (r.user_email ?? '').toLowerCase().includes(q) ||
          (r.peer_name ?? '').toLowerCase().includes(q) ||
          (r.user_id ?? '').toLowerCase().includes(q) ||
          inRecipients
        )
      })
    }
    return list
  }, [rows, filterEventId, filterRoundId, filterStatus, searchQuery])

  /** 이벤트 필터 적용 + 해당 이벤트에 사진 인증 방식이 있으면 카드형 표시 */
  const useCardLayout = useMemo(() => {
    if (!filterEventId || filteredRows.length === 0) return false
    const methods = filteredRows[0]?.verification_methods ?? []
    return methods.some((m) => m.method_type === 'PHOTO')
  }, [filterEventId, filteredRows])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pendingRows = useMemo(() => filteredRows.filter((r) => r.status === 'PENDING'), [filteredRows])

  const toggleAll = () => {
    const ids = pendingRows.map((r) => r.submission_id)
    if (ids.every((id) => selected.has(id))) setSelected(new Set())
    else setSelected(new Set(ids))
  }

  const handleApprove = async (id: string) => {
    setMessage(null)
    setPending(id)
    const result = await approveSubmission(id)
    setPending(null)
    if (result.error) setMessage({ type: 'error', text: result.error })
    else {
      const text = result.pointsGranted != null && result.pointsGranted > 0
        ? `승인되었습니다. 포인트 ${result.pointsGranted.toLocaleString()} C 지급 완료.`
        : '승인되었습니다.'
      setMessage({ type: 'ok', text })
      router.refresh()
    }
  }

  const handleRejectOne = (id: string) => {
    setRejectTarget({ ids: [id], isBulk: false })
    setRejectReason('')
    setShowRejectModal(true)
  }

  const handleBulkReject = () => {
    if (selected.size === 0) return
    setRejectTarget({ ids: [...selected], isBulk: true })
    setRejectReason('')
    setShowRejectModal(true)
  }

  const confirmReject = async () => {
    if (!rejectTarget) return
    setMessage(null)
    setPending(rejectTarget.isBulk ? 'bulk' : rejectTarget.ids[0])
    const result = rejectTarget.isBulk
      ? await bulkRejectSubmissionIds(rejectTarget.ids, rejectReason || undefined)
      : await rejectSubmission(rejectTarget.ids[0], rejectReason || undefined)
    setPending(null)
    setShowRejectModal(false)
    setRejectTarget(null)
    setRejectReason('')
    if (result.error) setMessage({ type: 'error', text: result.error })
    else {
      const okText = rejectTarget.isBulk && 'processed' in result
        ? `${result.processed}건 반려되었습니다.`
        : '반려되었습니다.'
      setMessage({ type: 'ok', text: okText })
      setSelected(new Set())
      router.refresh()
    }
  }

  const handleBulkApprove = async () => {
    if (selected.size === 0) return
    setMessage(null)
    setPending('bulk')
    const result = await bulkApproveSubmissionIds([...selected])
    setPending(null)
    if (result.error) setMessage({ type: 'error', text: result.error })
    else {
      const base = `${result.processed}건 승인되었습니다.`
      const text = result.pointsGranted != null && result.pointsGranted > 0
        ? `${base} 포인트 ${result.pointsGranted.toLocaleString()} C 지급 완료.`
        : base
      setMessage({ type: 'ok', text })
      setSelected(new Set())
      router.refresh()
    }
  }

  return (
    <>
      {message && (
        <p className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${message.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      {/* 필터 + 검색 */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <span className="text-sm font-bold text-gray-700">필터</span>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="참여자·수신자 검색..."
            className="min-w-[140px] rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          />
          <select
            value={filterEventId}
            onChange={(e) => setFilterEventId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            <option value="">전체 이벤트</option>
            {eventOptions.map((e) => (
              <option key={e.event_id} value={e.event_id}>
                {e.event_title}
              </option>
            ))}
          </select>
          {roundOptions.length > 0 && (
            <select
              value={filterRoundId}
              onChange={(e) => setFilterRoundId(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            >
              <option value="">전체 구간</option>
              {roundOptions.map(({ round_id, round_number }) => (
                <option key={round_id} value={round_id}>
                  {round_number}구간
                </option>
              ))}
            </select>
          )}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            <option value="">전체 상태</option>
            <option value="PENDING">승인대기</option>
            <option value="APPROVED">승인</option>
            <option value="REJECTED">반려</option>
          </select>
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600">
            {filteredRows.length}건
            {(filterEventId || filterRoundId) && (
              <span className="ml-1 text-gray-500">/ 전체 {rows.length}건</span>
            )}
          </span>
        </div>
      </div>

      {useCardLayout ? (
        /* 카드형: 이벤트 필터 + 사진 인증 방식 있을 때 */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((row) => (
            <SubmissionCard
              key={row.submission_id}
              row={row}
              selected={selected.has(row.submission_id)}
              onToggle={() => toggle(row.submission_id)}
              onApprove={() => handleApprove(row.submission_id)}
              onReject={() => handleRejectOne(row.submission_id)}
              pending={pending === row.submission_id}
              isResolved={row.status !== 'PENDING'}
            />
          ))}
        </div>
      ) : (
        /* 테이블형: 기본 */
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed text-left">
              <colgroup>
                <col className="w-12" />
                <col className="w-24" />
                <col className="w-32" />
                <col className="w-20" />
                <col className="w-40" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-44" />
              </colgroup>
              <thead className="border-b border-gray-200 bg-gray-50/80">
                <tr>
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={pendingRows.length > 0 && pendingRows.every((r) => selected.has(r.submission_id))}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </th>
                  <th className="px-4 py-4 text-sm font-semibold text-gray-700">상태</th>
                  <th className="px-4 py-4 text-sm font-semibold text-gray-700">이벤트</th>
                  <th className="px-4 py-4 text-sm font-semibold text-gray-700">구간</th>
                  <th className="px-4 py-4 text-sm font-semibold text-gray-700">참여자</th>
                  <th className="px-2 py-4 text-sm font-semibold text-gray-700">인증 미리보기</th>
                  <th className="border-l border-gray-200 px-2 py-4 text-sm font-semibold text-gray-700">제출일</th>
                  <th className="border-l border-gray-200 px-4 py-4 text-sm font-semibold text-gray-700">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => {
                  const isResolved = row.status !== 'PENDING'
                  const peerArrow = formatPeerHeaderSummary(row)
                  return (
                  <tr
                    key={row.submission_id}
                    className={`group transition ${isResolved ? 'bg-gray-50/70 opacity-80' : 'hover:bg-gray-50/50'}`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(row.submission_id)}
                        onChange={() => toggle(row.submission_id)}
                        disabled={isResolved}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : row.status === 'APPROVED'
                              ? 'bg-gray-200 text-gray-600'
                              : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className={`truncate px-4 py-4 text-sm font-medium ${isResolved ? 'text-gray-500' : 'text-gray-900'}`} title={row.event_title}>{row.event_title}</td>
                    <td className={`whitespace-nowrap px-4 py-4 text-sm ${isResolved ? 'text-gray-500' : 'text-gray-600'}`}>{row.round_number != null ? `${row.round_number}구간` : '상시'}</td>
                    <td className="overflow-hidden px-4 py-4">
                      <div
                        className="flex min-w-0 items-center gap-1 overflow-hidden"
                        title={`${row.user_name ?? row.user_email ?? row.user_id}${peerArrow ? ` → ${peerArrow}` : ''}${row.is_anonymous ? ' (익명 제출)' : ''}`}
                      >
                        <span className={`min-w-0 truncate text-sm font-medium ${isResolved ? 'text-gray-500' : 'text-gray-900'}`}>
                          {row.user_name ?? row.user_email ?? row.user_id}
                          {peerArrow && ` → ${peerArrow}`}
                        </span>
                        {row.is_anonymous && (
                          <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600" title="칭찬 수신자에게는 익명 표시">
                            익명
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="overflow-hidden px-2 py-4">
                      <VerificationPreviewCell row={row} />
                    </td>
                    <td className="whitespace-nowrap border-l border-gray-100 px-2 py-4 text-sm text-gray-500">
                      {new Date(row.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className={`whitespace-nowrap border-l border-gray-100 px-4 py-4 ${isResolved ? 'bg-gray-50/70' : 'bg-white group-hover:bg-gray-50/50'}`}>
                      {isResolved ? (
                        <span className="block truncate text-sm text-gray-400" title={row.rejection_reason ? `반려: ${row.rejection_reason}` : undefined}>
                          {row.status === 'APPROVED' ? '승인됨' : row.rejection_reason ? `반려: ${row.rejection_reason}` : '반려됨'}
                        </span>
                      ) : (
                        <div className="flex shrink-0 flex-nowrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(row.submission_id)}
                            disabled={pending !== null}
                            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 btn-press"
                          >
                            {pending === row.submission_id ? '처리 중' : '승인'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectOne(row.submission_id)}
                            disabled={pending !== null}
                            className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 btn-press"
                          >
                            반려
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-xl">
          <span className="font-bold text-gray-800">{selected.size}건 선택</span>
          <button
            type="button"
            onClick={handleBulkApprove}
            disabled={pending !== null}
            className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50 btn-press"
          >
            {pending === 'bulk' ? '처리 중…' : '일괄 승인'}
          </button>
          <button
            type="button"
            onClick={handleBulkReject}
            disabled={pending !== null}
            className="rounded-xl border-2 border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 btn-press"
          >
            일괄 반려
          </button>
        </div>
      )}

      {showRejectModal && rejectTarget && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              {rejectTarget.isBulk ? `${rejectTarget.ids.length}건 반려` : '반려'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">반려 사유 (선택)</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="사유를 입력하세요"
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowRejectModal(false); setRejectTarget(null) }}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={pending !== null}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 btn-press"
              >
                반려하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** 카드형: 사진 + 텍스트 + 숫자 등 인증 내용 카드 */
function SubmissionCard({
  row,
  selected,
  onToggle,
  onApprove,
  onReject,
  pending,
  isResolved,
}: {
  row: PendingSubmissionRow
  selected: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  pending: boolean
  isResolved?: boolean
}) {
  const methods = row.verification_methods ?? []
  const vd = row.verification_data ?? {}
  const resolved = isResolved ?? row.status !== 'PENDING'
  const peerArrow = formatPeerHeaderSummary(row)

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border shadow-sm transition ${resolved ? 'border-gray-200 bg-gray-50/80 opacity-80' : 'border-gray-200 bg-white hover:shadow-md'}`}>
      {/* 헤더: 체크박스 + 상태 + 참여자 + 구간 + 제출일 */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={resolved}
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              row.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
          <div className="min-w-0 overflow-hidden">
            <p className={`truncate text-sm font-semibold ${resolved ? 'text-gray-500' : 'text-gray-900'}`} title={`${row.user_name ?? row.user_email ?? row.user_id}${peerArrow ? ` → ${peerArrow}` : ''}`}>
              {row.user_name ?? row.user_email ?? row.user_id}
              {peerArrow && ` → ${peerArrow}`}
              {row.is_anonymous && ' (익명)'}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {row.round_number != null ? `${row.round_number}구간` : '상시'} · {new Date(row.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {resolved && row.rejection_reason && ` · 반려: ${row.rejection_reason}`}
            </p>
          </div>
        </div>
      </div>

      {/* 인증 내용: 사진 + 텍스트/숫자 카드 */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {methods.length > 0 ? (
          methods.map((m) => {
            const val = vd[m.method_id]
            if (val === undefined || val === null) return null
            const urls = m.method_type === 'PHOTO'
              ? (Array.isArray(val) ? (val as string[]).filter(Boolean) : [String(val).trim()].filter(Boolean))
              : []
            const str = m.method_type === 'PHOTO' ? '' : String(val).trim()
            if (m.method_type === 'PHOTO' && urls.length === 0) return null
            if (m.method_type !== 'PHOTO' && str === '') return null

            if (m.method_type === 'PHOTO') {
              const displayLabel = m.label || (METHOD_LABEL[m.method_type] ?? m.method_type)
              return (
                <div key={m.method_id} className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500">{displayLabel} {urls.length > 1 && `(${urls.length}장)`}</p>
                  <div className="flex flex-wrap gap-2">
                    {urls.map((url) => (
                      <VerificationPhotoCard key={url} url={url} />
                    ))}
                  </div>
                </div>
              )
            }
            if (m.method_type === 'VALUE') {
              const displayLabel = m.label || '수치'
              const displayValue = m.unit ? `${str} ${m.unit}` : str
              return (
                <div key={m.method_id} className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500">{displayLabel}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">{displayValue}</p>
                </div>
              )
            }
            if (m.method_type === 'PEER_SELECT') {
              const displayLabel = m.label || (METHOD_LABEL[m.method_type] ?? m.method_type)
              const displayValue = parsePeerSelectDisplay(val, row.peer_name, row)
              return (
                <div key={m.method_id} className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500">{displayLabel}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{displayValue}</p>
                </div>
              )
            }
            const displayLabel = m.label || (METHOD_LABEL[m.method_type] ?? m.method_type)
            return (
              <div key={m.method_id} className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500">{displayLabel}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{str}</p>
              </div>
            )
          })
        ) : (
          /* methods 없을 때 fallback: preview 값으로 표시 */
          <>
            {row.preview_photo_url && <VerificationPhotoCard url={row.preview_photo_url} />}
            {(row.preview_text || row.preview_value) && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3">
                {row.preview_text && <p className="whitespace-pre-wrap break-words text-sm text-gray-800">{row.preview_text}</p>}
                {row.preview_value != null && row.preview_value !== '' && (
                  <p className="mt-2 text-lg font-bold text-gray-900">{String(row.preview_value)}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 액션: 승인대기만 버튼 표시 */}
      <div className="flex gap-2 border-t border-gray-100 p-4">
        {resolved ? (
          <span className="flex-1 py-2.5 text-center text-sm text-gray-400">
            {row.status === 'APPROVED' ? '승인됨' : row.rejection_reason ? `반려: ${row.rejection_reason}` : '반려됨'}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onApprove}
              disabled={pending}
              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50 btn-press"
            >
              {pending ? '처리 중' : '승인'}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={pending}
              className="flex-1 rounded-xl border-2 border-red-300 bg-white py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 btn-press"
            >
              반려
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function VerificationPhotoCard({ url }: { url: string }) {
  const [expand, setExpand] = useState(false)
  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
        <button
          type="button"
          onClick={() => setExpand(true)}
          className="block w-full transition hover:opacity-90"
        >
          <img src={url} alt="인증 사진" className="h-48 w-full object-cover" />
        </button>
      </div>
      {expand && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setExpand(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setExpand(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img src={url} alt="인증 원본" className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
            <button
              type="button"
              onClick={() => setExpand(false)}
              className="absolute -right-2 -top-2 rounded-full bg-white/95 p-2 text-gray-700 shadow-lg transition hover:bg-white"
              aria-label="닫기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** 인증 미리보기: 버튼만 표시, 클릭 시 전체 모달 */
function VerificationPreviewCell({ row }: { row: PendingSubmissionRow }) {
  const vd = row.verification_data ?? {}
  const methods = row.verification_methods ?? []
  const [showModal, setShowModal] = useState(false)

  const items: { type: 'photo' | 'text' | 'value'; label?: string; unit?: string; value: string; values?: string[] }[] = []

  if (methods.length > 0) {
    for (const m of methods) {
      const val = vd[m.method_id]
      if (val === undefined || val === null) continue
      if (m.method_type === 'PHOTO') {
        const urls = Array.isArray(val) ? (val as string[]).filter(Boolean) : [String(val).trim()].filter(Boolean)
        if (urls.length > 0) items.push({ type: 'photo', value: urls[0], values: urls })
      } else {
        const str = Array.isArray(val) ? (val as string[]).join(', ') : String(val).trim()
        if (str === '') continue
        if (m.method_type === 'VALUE') items.push({ type: 'value', label: m.label ?? undefined, unit: m.unit ?? undefined, value: str })
        else if (m.method_type === 'PEER_SELECT') {
          items.push({
            type: 'text',
            label: m.label ?? undefined,
            value: parsePeerSelectDisplay(val, row.peer_name, row),
          })
        }
        else items.push({ type: 'text', label: m.label ?? undefined, value: str })
      }
    }
  } else {
    if (row.preview_photo_url) items.push({ type: 'photo', value: row.preview_photo_url })
    if (row.preview_text) items.push({ type: 'text', value: row.preview_text })
    if (row.preview_value != null && row.preview_value !== '') items.push({ type: 'value', value: String(row.preview_value) })
  }

  if (items.length === 0) return <span className="text-gray-400">—</span>

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
      >
        미리보기
      </button>
      {showModal && (
        <VerificationDetailModal
          row={row}
          items={items}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

/** 인증 상세 모달: 항목 설명 + 제출답변 예쁜 레이아웃 */
function VerificationDetailModal({
  row,
  items,
  onClose,
}: {
  row: PendingSubmissionRow
  items: { type: 'photo' | 'text' | 'value'; label?: string; unit?: string; value: string; values?: string[] }[]
  onClose: () => void
}) {
  const [expandPhoto, setExpandPhoto] = useState<string | null>(null)
  const methods = row.verification_methods ?? []
  const vd = row.verification_data ?? {}

  // methods 순서대로 항목 구성 (label, value). PHOTO는 배열 지원 (values)
  const peerHeaderLabel = formatPeerHeaderSummary(row)

  const modalItems = methods.length > 0
    ? methods
        .map((m) => {
          let val = vd[m.method_id]
          if (val === undefined || val === null) {
            if (m.method_type === 'PHOTO' && row.preview_photo_url) val = row.preview_photo_url
            else return null
          }
          const urls = m.method_type === 'PHOTO'
            ? (Array.isArray(val) ? (val as string[]).filter(Boolean) : [String(val).trim()].filter(Boolean))
            : []
          const str = m.method_type === 'PHOTO' ? urls[0] ?? '' : String(val).trim()
          if (m.method_type === 'PHOTO' && urls.length === 0) return null
          if (m.method_type !== 'PHOTO' && !str) return null
          const label = m.label || METHOD_LABEL[m.method_type] || m.method_type
          const displayValue =
            m.method_type === 'PEER_SELECT' ? parsePeerSelectDisplay(val, row.peer_name, row) : str
          const peerBlock =
            m.method_type === 'PEER_SELECT' ? buildPeerSelectModalBlock(val, row) : undefined
          return {
            method_type: m.method_type,
            label,
            unit: m.unit,
            value: displayValue,
            photoUrls: urls,
            peerBlock,
          }
        })
        .filter(Boolean) as {
          method_type: string
          label: string
          unit?: string | null
          value: string
          photoUrls?: string[]
          peerBlock?: { teamLabel: string | null; memberLines: string[] }
        }[]
    : items.map((item) => ({
        method_type: item.type === 'photo' ? 'PHOTO' : item.type === 'value' ? 'VALUE' : 'TEXT',
        label: item.label || (item.type === 'photo' ? '사진' : item.type === 'value' ? '수치' : '텍스트'),
        unit: item.unit,
        value: item.value,
        photoUrls: item.type === 'photo' ? (item.values ?? [item.value]) : undefined,
        peerBlock: undefined,
      }))

  // Portal로 document.body에 렌더링 → 테이블 overflow/stacking context 영향 없이 모달이 최상단에 표시됨
  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-gray-900">인증 상세 보기</h3>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium text-gray-500">이벤트</span> {row.event_title}
                  <span className="ml-2 text-gray-400">·</span>
                  <span className="font-medium text-gray-500">구간</span> {row.round_number != null ? `${row.round_number}구간` : '상시'}
                </p>
                <p>
                  <span className="font-medium text-gray-500">참여자</span>{' '}
                  {row.user_name ?? row.user_email ?? row.user_id}
                  {peerHeaderLabel && (
                    <>
                      <span className="text-gray-400"> → </span>
                      {peerHeaderLabel}
                    </>
                  )}
                  {row.is_anonymous && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">익명 제출</span>
                  )}
                </p>
                <p>
                  <span className="font-medium text-gray-500">제출일시</span>{' '}
                  {new Date(row.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="닫기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* 항목별 카드: 항목 설명 + 제출 답변 */}
        <div className="space-y-4 p-6">
          {modalItems.map((item, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
              <p className="mt-1 text-xs text-gray-400">제출 답변</p>
              {item.method_type === 'PHOTO' ? (
                <div className="mt-3 space-y-3">
                  {(item.photoUrls ?? (item.value ? [item.value] : [])).filter(Boolean).map((url, i) => (
                    <div key={url}>
                      <button
                        type="button"
                        onClick={() => setExpandPhoto(url)}
                        className="block w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition hover:opacity-90"
                      >
                        <img
                          src={url}
                          alt={`${item.label} ${i + 1}`}
                          className="h-48 w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const next = e.currentTarget.nextElementSibling
                            if (next instanceof HTMLElement) next.style.display = 'block'
                          }}
                        />
                        <span className="hidden py-8 text-center text-sm text-gray-500" aria-hidden>
                          이미지를 불러올 수 없습니다.
                        </span>
                      </button>
                      {(item.photoUrls ?? [item.value]).length > 1 && (
                        <p className="mt-1 text-center text-xs text-gray-500">{i + 1} / {(item.photoUrls ?? [item.value]).length}장</p>
                      )}
                    </div>
                  ))}
                  <p className="text-center text-xs text-gray-500">클릭 시 크게 보기</p>
                  {expandPhoto && (
                    <div
                      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 p-4"
                      onClick={() => setExpandPhoto(null)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Escape' && setExpandPhoto(null)}
                    >
                      <img src={expandPhoto} alt="인증 원본" className="max-h-[90vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
                    </div>
                  )}
                </div>
              ) : item.method_type === 'PEER_SELECT' && item.peerBlock ? (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3">
                  {item.peerBlock.teamLabel ? (
                    <p className="text-sm font-bold text-gray-900">
                      팀(부서){' '}
                      <span className="font-semibold text-emerald-800">{item.peerBlock.teamLabel}</span>
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    포함 인원 ({item.peerBlock.memberLines.length}명)
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm font-medium text-gray-900">
                    {item.peerBlock.memberLines.map((line: string, j: number) => (
                      <li key={j} className="break-words">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3">
                  <p className="whitespace-pre-wrap break-words text-base font-medium text-gray-900">
                    {item.unit ? `${item.value} ${item.unit}` : item.value}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
