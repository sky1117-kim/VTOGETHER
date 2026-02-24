'use client'

import { useState, useMemo, useEffect } from 'react'
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
  const [filterStatus, setFilterStatus] = useState<string>('')

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
    return list
  }, [rows, filterEventId, filterRoundId, filterStatus])

  /** 이벤트 필터 적용 + 해당 이벤트에 사진 인증 방식이 있으면 카드형 표시 */
  const useCardLayout = useMemo(() => {
    if (!filterEventId || filteredRows.length === 0) return false
    const methods = filteredRows[0]?.verification_methods ?? []
    return methods.some((m) => m.method_type === 'PHOTO')
  }, [filterEventId, filteredRows])

  useEffect(() => {
    if (filterEventId && !roundOptions.some((o) => o.round_id === filterRoundId)) {
      setFilterRoundId('')
    }
  }, [filterEventId, filterRoundId, roundOptions])

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
        ? `승인되었습니다. 포인트 ${result.pointsGranted.toLocaleString()} P 지급 완료.`
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
        ? `${base} 포인트 ${result.pointsGranted.toLocaleString()} P 지급 완료.`
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

      {/* 필터: 가독성 개선 */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <span className="text-sm font-bold text-gray-700">필터</span>
        <div className="flex flex-wrap items-center gap-3">
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
            <table className="w-full min-w-[720px] text-left text-sm">
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
                  <th className="px-4 py-4 font-semibold text-gray-700">상태</th>
                  <th className="px-4 py-4 font-semibold text-gray-700">이벤트</th>
                  <th className="px-4 py-4 font-semibold text-gray-700">구간</th>
                  <th className="px-4 py-4 font-semibold text-gray-700">참여자</th>
                  <th className="px-4 py-4 font-semibold text-gray-700">인증 미리보기</th>
                  <th className="px-4 py-4 font-semibold text-gray-700">제출일</th>
                  <th className="px-4 py-4 font-semibold text-gray-700">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => {
                  const isResolved = row.status !== 'PENDING'
                  return (
                  <tr
                    key={row.submission_id}
                    className={`transition ${isResolved ? 'bg-gray-50/70 opacity-80' : 'hover:bg-gray-50/50'}`}
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
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
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
                    <td className={`px-4 py-4 font-medium ${isResolved ? 'text-gray-500' : 'text-gray-900'}`}>{row.event_title}</td>
                    <td className={`px-4 py-4 ${isResolved ? 'text-gray-500' : 'text-gray-600'}`}>{row.round_number != null ? `${row.round_number}구간` : '상시'}</td>
                    <td className="min-w-0 max-w-[180px] px-4 py-4">
                      <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                        <span className={`truncate font-medium ${isResolved ? 'text-gray-500' : 'text-gray-900'}`} title={row.user_name ?? row.user_email ?? row.user_id}>
                          {row.user_name ?? row.user_email ?? row.user_id}
                        </span>
                        {row.peer_name && (
                          <span className="truncate text-xs text-gray-500" title={row.peer_name}>
                            → {row.peer_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[240px] px-4 py-4">
                      <VerificationPreviewCompact
                        photoUrl={row.preview_photo_url ?? undefined}
                        text={row.preview_text ?? undefined}
                        value={row.preview_value ?? undefined}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-500">
                      {new Date(row.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-4">
                      {isResolved ? (
                        <span className="text-xs text-gray-400">
                          {row.status === 'APPROVED' ? '승인됨' : row.rejection_reason ? `반려: ${row.rejection_reason}` : '반려됨'}
                        </span>
                      ) : (
                        <div className="flex gap-2">
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
            <p className={`truncate font-semibold ${resolved ? 'text-gray-500' : 'text-gray-900'}`}>{row.user_name ?? row.user_email ?? row.user_id}</p>
            {row.peer_name && (
              <p className="truncate text-xs text-gray-500">→ {row.peer_name}</p>
            )}
            <p className="mt-0.5 text-xs text-gray-500">
              {row.round_number != null ? `${row.round_number}구간` : '상시'} · {new Date(row.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {resolved && row.rejection_reason && (
                <span className="ml-1 text-gray-400">· 반려: {row.rejection_reason}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 인증 내용: 사진 + 텍스트/숫자 카드 */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {methods.length > 0 ? (
          methods.map((m) => {
            const val = vd[m.method_id]
            if (val === undefined || val === null || String(val).trim() === '') return null
            const str = String(val).trim()

            if (m.method_type === 'PHOTO') {
              return <VerificationPhotoCard key={m.method_id} url={str} />
            }
            if (m.method_type === 'VALUE') {
              return (
                <div key={m.method_id} className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{METHOD_LABEL[m.method_type] ?? m.method_type}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">{str}</p>
                </div>
              )
            }
            return (
              <div key={m.method_id} className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{METHOD_LABEL[m.method_type] ?? m.method_type}</p>
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
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpand(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setExpand(false)}
        >
          <img src={url} alt="인증 원본" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </>
  )
}

function VerificationPreviewCompact({
  photoUrl,
  text,
  value,
}: {
  photoUrl?: string
  text?: string
  value?: number | string
}) {
  const [expandPhoto, setExpandPhoto] = useState(false)
  const hasPhoto = !!photoUrl
  const hasText = text !== undefined && text !== ''
  const hasValue = value !== undefined && value !== null && value !== ''

  if (!hasPhoto && !hasText && !hasValue) return <span className="text-gray-400">—</span>

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasPhoto && (
        <>
          <button
            type="button"
            onClick={() => setExpandPhoto(true)}
            className="h-14 w-14 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 object-cover transition hover:opacity-90"
          >
            <img src={photoUrl} alt="인증" className="h-full w-full object-cover" />
          </button>
          {expandPhoto && (
            <div
              className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setExpandPhoto(false)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Escape' && setExpandPhoto(false)}
            >
              <img src={photoUrl} alt="인증 원본" className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </>
      )}
      {hasText && (
        <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs text-gray-800 line-clamp-2 max-w-[160px]">
          {String(text)}
        </span>
      )}
      {hasValue && (
        <span className="font-bold text-gray-900">{String(value)}</span>
      )}
    </div>
  )
}
