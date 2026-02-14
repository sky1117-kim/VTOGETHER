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

  // 이벤트별·구간별 필터
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
    return list
  }, [rows, filterEventId, filterRoundId])

  // 구간 필터는 이벤트 변경 시 초기화
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

  const toggleAll = () => {
    if (selected.size === filteredRows.length) setSelected(new Set())
    else setSelected(new Set(filteredRows.map((r) => r.submission_id)))
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
        <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${message.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      {/* 이벤트·구간 필터 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-sm font-medium text-gray-600">필터</span>
        <select
          value={filterEventId}
          onChange={(e) => setFilterEventId(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
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
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">전체 구간</option>
            {roundOptions.map(({ round_id, round_number }) => (
              <option key={round_id} value={round_id}>
                {round_number}구간
              </option>
            ))}
          </select>
        )}
        <span className="text-xs text-gray-500">
          {filteredRows.length}건
          {(filterEventId || filterRoundId) && ` (전체 ${rows.length}건)`}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && selected.size === filteredRows.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                </th>
                <th className="px-3 py-3 font-medium">이벤트</th>
                <th className="px-3 py-3 font-medium">구간</th>
                <th className="px-3 py-3 font-medium">참여자</th>
                <th className="px-3 py-3 font-medium">인증 미리보기</th>
                <th className="px-3 py-3 font-medium">제출일</th>
                <th className="px-3 py-3 font-medium">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr key={row.submission_id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.submission_id)}
                      onChange={() => toggle(row.submission_id)}
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900">{row.event_title}</td>
                  <td className="px-3 py-3 text-gray-600">{row.round_number != null ? `${row.round_number}회차` : '상시'}</td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-gray-900">{row.user_name ?? row.user_email ?? row.user_id}</span>
                    {row.peer_name && (
                      <span className="ml-1 text-xs text-gray-500">→ {row.peer_name}</span>
                    )}
                  </td>
                  <td className="max-w-[220px] px-3 py-3">
                    <VerificationPreview
                      photoUrl={row.preview_photo_url ?? undefined}
                      text={row.preview_text ?? undefined}
                      value={row.preview_value ?? undefined}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-500">
                    {new Date(row.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(row.submission_id)}
                        disabled={pending !== null}
                        className="rounded-lg bg-green-600 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        {pending === row.submission_id ? '처리 중' : '승인'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectOne(row.submission_id)}
                        disabled={pending !== null}
                        className="rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        반려
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-lg">
          <span className="font-medium text-gray-700">{selected.size}건 선택</span>
          <button
            type="button"
            onClick={handleBulkApprove}
            disabled={pending !== null}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {pending === 'bulk' ? '처리 중…' : '일괄 승인'}
          </button>
          <button
            type="button"
            onClick={handleBulkReject}
            disabled={pending !== null}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
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
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowRejectModal(false); setRejectTarget(null) }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={pending !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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

function VerificationPreview({
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
            className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 object-cover transition hover:opacity-90"
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
        <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-800 line-clamp-2 max-w-[180px]">
          {String(text)}
        </span>
      )}
      {hasValue && (
        <span className="font-semibold text-gray-900">{String(value)}</span>
      )}
    </div>
  )
}
