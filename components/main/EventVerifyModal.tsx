'use client'
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { getEventForParticipationAction, submitEventSubmission, uploadEventVerificationPhoto } from '@/api/actions/events'
import { uploadEventPhotoClient } from '@/lib/upload-event-photo'
import type { VerificationMethodRow, RoundForParticipation, PeerSelectionUserRow } from '@/api/queries/events'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDecimalWithCommas, sanitizeDecimalInput } from '@/lib/number-format'

type PeerSelectPayload = {
  peer_user_ids: string[]
}

function isMultiPeerSelectMode(method: { options?: string[] | null }): boolean {
  return Array.isArray(method.options) && method.options.includes('MULTIPLE')
}

const METHOD_LABEL: Record<string, string> = {
  PHOTO: '사진',
  TEXT: '텍스트',
  VALUE: '숫자',
  PEER_SELECT: '칭찬 대상 추가',
}

function resolveInputPlaceholder(method: VerificationMethodRow, fallback = '입력하세요') {
  return method.placeholder?.trim() || method.instruction?.trim() || fallback
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20'

const ROUND_STATUS_LABEL: Record<string, string> = {
  OPEN: '인증 가능',
  LOCKED: '미오픈',
  SUBMITTED: '승인 대기중',
  APPROVED: '승인 완료',
  DONE: '완료',
  FAILED: '마감',
}
interface EventVerifyModalProps {
  eventId: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function EventVerifyModal({ eventId, isOpen, onClose, onSuccess }: EventVerifyModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitPending, setSubmitPending] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [data, setData] = useState<{
    event: { event_id: string; title: string; type: string }
    verificationMethods: VerificationMethodRow[]
    rounds: RoundForParticipation[]
    canParticipate?: { allowed: boolean; reason?: string; nextAvailableAt?: string }
    peerSelectionUsers?: PeerSelectionUserRow[]
    currentUserId?: string | null
  } | null>(null)
  const [peerSearch, setPeerSearch] = useState('')
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  /** PHOTO 인증 방식: method_id별 업로드된 사진 URL 배열 (최소 1장 필수) */
  const [photoUrlsByMethod, setPhotoUrlsByMethod] = useState<Record<string, string[]>>({})
  /** 칭찬 챌린지(PEER_SELECT) 시 익명으로 칭찬 보내기 선택 여부 */
  const [isAnonymous, setIsAnonymous] = useState(false)
  /** 숫자(VALUE) 인증 필드별 에러 (숫자 아닌 문자 입력 시) */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const parsePeerSelectPayload = (methodId: string): PeerSelectPayload => {
    const raw = formData[methodId]
    if (!raw) return { peer_user_ids: [] }
    try {
      const parsed = JSON.parse(raw) as Partial<PeerSelectPayload>
      const peer_user_ids = Array.isArray(parsed.peer_user_ids)
        ? parsed.peer_user_ids.filter((v): v is string => typeof v === 'string' && !!v.trim())
        : []
      return { peer_user_ids }
    } catch {
      return { peer_user_ids: [] }
    }
  }

  const updatePeerSelectPayload = (
    methodId: string,
    updater: (prev: PeerSelectPayload) => PeerSelectPayload
  ) => {
    const current = parsePeerSelectPayload(methodId)
    const next = updater(current)
    setFormData((prev) => ({
      ...prev,
      [methodId]: JSON.stringify(next),
    }))
  }

  useEffect(() => {
    if (!isOpen || !eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null)
      setError(null)
      setSuccess(false)
      setFormData({})
      setPhotoUrlsByMethod({})
      setFieldErrors({})
      setSelectedRoundId(null)
      setPeerSearch('')
      setIsAnonymous(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getEventForParticipationAction(eventId)
      .then((res) => {
        // 모달 닫힘/이벤트 변경으로 effect가 정리되면 늦은 응답은 무시합니다.
        if (cancelled) return
        if (res.error || !res.data) {
          setError(res.error ?? '불러오기 실패')
          setData(null)
          return
        }
        setData(res.data)
        const openRound = res.data.rounds.find((r) => r.status === 'OPEN')
        if (openRound) setSelectedRoundId(openRound.round_id)
        else if (res.data.rounds.length > 0) setSelectedRoundId(res.data.rounds[0].round_id)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, eventId])

  const handlePhotoAdd = async (methodId: string, file: File | null) => {
    if (!file) return
    setUploadingId(methodId)
    setError(null)
    let result = await uploadEventPhotoClient(file)
    if (result.error) {
      const fd = new FormData()
      fd.set('file', file)
      result = await uploadEventVerificationPhoto(fd)
    }
    setUploadingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.url) {
      setPhotoUrlsByMethod((prev) => ({
        ...prev,
        [methodId]: [...(prev[methodId] ?? []), result.url!],
      }))
    }
  }

  const handlePhotoRemove = (methodId: string, index: number) => {
    setPhotoUrlsByMethod((prev) => {
      const arr = prev[methodId] ?? []
      const next = arr.filter((_, i) => i !== index)
      if (next.length === 0) {
        const rest = { ...prev }
        delete rest[methodId]
        return rest
      }
      return { ...prev, [methodId]: next }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId || !data) return
    const roundId = data.event.type === 'SEASONAL' ? selectedRoundId : null
    if (data.event.type === 'SEASONAL' && !roundId) {
      setError('구간을 선택하세요.')
      return
    }
    const verificationData: Record<string, unknown> = {}
    const missing: string[] = []
    const peerUserIds: string[] = []
    for (const m of data.verificationMethods) {
      if (m.method_type === 'PEER_SELECT') {
        const peerSelect = parsePeerSelectPayload(m.method_id)
        const isMultiMode = isMultiPeerSelectMode(m)
        if (peerSelect.peer_user_ids.length === 0) missing.push('동료 선택')
        if (!isMultiMode && peerSelect.peer_user_ids.length > 1) {
          setError('개인형 칭찬 챌린지는 동료 1명만 선택할 수 있습니다.')
          return
        }
        verificationData[m.method_id] = peerSelect
        peerUserIds.push(...peerSelect.peer_user_ids)
      } else if (m.method_type === 'PHOTO') {
        const urls = photoUrlsByMethod[m.method_id] ?? []
        if (urls.length < 1) missing.push('사진')
        verificationData[m.method_id] = urls
      } else {
        const value = formData[m.method_id]?.trim() ?? ''
        if (!value) missing.push(METHOD_LABEL[m.method_type])
        verificationData[m.method_id] = value
      }
    }
    if (missing.length > 0) {
      setError(`필수 항목을 모두 입력해주세요: ${missing.join(', ')}`)
      return
    }
    const valueFieldErrors = Object.entries(fieldErrors).filter(([, msg]) => msg)
    if (valueFieldErrors.length > 0) {
      setError(valueFieldErrors[0][1])
      return
    }
    const normalizedPeerUserIds = [...new Set(peerUserIds.map((id) => id.trim()).filter(Boolean))]
    if (normalizedPeerUserIds.length > 0) {
      verificationData.peer_user_ids = normalizedPeerUserIds
    }
    setSubmitPending(true)
    setError(null)
    const result = await submitEventSubmission(eventId, roundId, verificationData, normalizedPeerUserIds, isAnonymous)
    setSubmitPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSuccess(true)
    onSuccess?.()
    setTimeout(() => onClose(), 1500)
  }

  // 모달 열림 시 배경 스크롤 방지
  useBodyScrollLock(isOpen)

  if (!isOpen) return null

  const cannotParticipateAlways = data?.event.type === 'ALWAYS' && data.canParticipate && !data.canParticipate.allowed

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      {/* 높이는 내용 기준 + 상한만 둠. 고정 vh는 사진 첨부 후에도 아래에 빈 여백이 크게 남음 */}
      <div
        className="relative z-10 flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 고정 */}
        <div className="flex-shrink-0 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Event Verification</p>
              <h3 className="mt-1 text-xl font-bold text-gray-900">이벤트 인증</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 본문: flex-1 없이 max-height로만 스크롤 → 짧은 폼에서 하단 빈 공백 방지 */}
        <div className="min-h-0 min-w-0 max-h-[min(75vh,calc(92vh-14rem))] overflow-y-auto p-6 pt-4">
        {loading && (
          <div className="space-y-6" aria-busy="true" aria-label="이벤트 정보 불러오는 중">
            <Skeleton className="h-5 w-3/4 max-w-xs rounded" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <div className="w-full max-w-md rounded-xl bg-green-50 px-4 py-4 text-center text-sm text-green-800">
              제출되었습니다. 심사 후 보상이 지급됩니다.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full max-w-md rounded-xl border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        )}
        {!loading && data && !success && cannotParticipateAlways && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <div className="w-full max-w-md space-y-4">
              <p className="text-center text-base font-semibold text-gray-800">{data.event.title}</p>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
                {data.canParticipate?.reason ?? '지금은 참여할 수 없습니다.'}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {!loading && data && !success && !cannotParticipateAlways && (
          <form id="event-verify-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <p className="text-xs font-medium text-emerald-700">참여 이벤트</p>
              <p className="mt-1 text-base font-semibold text-gray-900">{data.event.title}</p>
            </div>

            {/* 구간 선택: 카드형 버튼 그룹 */}
            {data.event.type === 'SEASONAL' && data.rounds.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-700">인증할 구간</p>
                <div className="flex flex-wrap gap-2">
                  {data.rounds.map((r) => {
                    const isOpen = r.status === 'OPEN'
                    const isSelected = selectedRoundId === r.round_id
                    return (
                      <button
                        key={r.round_id}
                        type="button"
                        onClick={() => isOpen && setSelectedRoundId(r.round_id)}
                        disabled={!isOpen}
                        className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
                          !isOpen
                            ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                            : isSelected
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:bg-green-50/50'
                        }`}
                      >
                        {r.round_number}구간 · {ROUND_STATUS_LABEL[r.status ?? ''] ?? r.status}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 인증 방식이 없을 때 안내 */}
            {data.verificationMethods.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                이 이벤트에는 인증 방식(사진·텍스트 등)이 등록되지 않았습니다. 관리자에게 문의하세요.
              </div>
            )}

            {/* 인증 내용: 항목별 카드 */}
            {data.verificationMethods.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm font-bold text-gray-700">인증 내용</p>
                <div className="space-y-4">
                  {data.verificationMethods.map((m) => {
                    const isShort = m.input_style === 'SHORT'
                    if (m.method_type === 'PHOTO') {
                      const urls = photoUrlsByMethod[m.method_id] ?? []
                      return (
                        <div key={m.method_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                          <label className="mb-2 block text-sm font-bold text-gray-800">
                            {m.label?.trim() || METHOD_LABEL[m.method_type]}
                            <span className="ml-1 font-normal text-amber-600">(최소 1장 필수)</span>
                          </label>
                          {m.instruction?.trim() && (
                            <p className="mb-2 text-xs text-gray-500">{m.instruction.trim()}</p>
                          )}
                          <div className="space-y-2">
                            {urls.map((url, i) => (
                              <div key={url} className="flex items-center gap-2">
                                <img src={url} alt={`첨부 ${i + 1}`} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                                <button
                                  type="button"
                                  onClick={() => handlePhotoRemove(m.method_id, i)}
                                  className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                >
                                  삭제
                                </button>
                              </div>
                            ))}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handlePhotoAdd(m.method_id, file)
                                e.target.value = ''
                              }}
                              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-green-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:hover:bg-green-600"
                            />
                          </div>
                          {uploadingId === m.method_id && (
                            <p className="mt-2 text-xs text-gray-500">업로드 중…</p>
                          )}
                          {urls.length > 0 && (
                            <p className="mt-2 text-xs font-medium text-green-600">
                              ✓ {urls.length}장 첨부됨
                            </p>
                          )}
                        </div>
                      )
                    }
                    if (m.method_type === 'VALUE') {
                      const raw = formData[m.method_id] ?? ''
                      const valueError = fieldErrors[m.method_id]
                      return (
                        <div key={m.method_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                          <label className="mb-2 block text-sm font-bold text-gray-800">
                            {(m.label?.trim() || METHOD_LABEL[m.method_type])}
                            {m.unit && (
                              <span className="ml-1 font-normal text-gray-500">— {m.unit}</span>
                            )}
                            {m.instruction?.trim() && (
                              <span className="ml-1 font-normal text-gray-500">
                                {m.unit ? ' · ' : ' — '}
                                {m.instruction.trim()}
                              </span>
                            )}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={raw === '' ? '' : formatDecimalWithCommas(raw)}
                            onChange={(e) => {
                              const input = e.target.value
                              const hasInvalid =
                                /[^\d,.]/.test(input) || (input.match(/\./g) || []).length > 1
                              setFieldErrors((prev) => ({
                                ...prev,
                                [m.method_id]: hasInvalid ? '숫자, 콤마(천 단위), 소수점(.)만 입력해주세요.' : '',
                              }))
                              setFormData((prev) => ({
                                ...prev,
                                [m.method_id]: sanitizeDecimalInput(input),
                              }))
                            }}
                            className={`${inputClass} ${valueError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                            placeholder={resolveInputPlaceholder(
                              m,
                              m.unit ? `숫자 입력 (콤마·소수점 가능) ${m.unit}` : '숫자 입력 (콤마·소수점 가능)'
                            )}
                          />
                          {valueError && (
                            <p className="mt-2 text-sm font-medium text-red-600">{valueError}</p>
                          )}
                        </div>
                      )
                    }
                    if (m.method_type === 'PEER_SELECT') {
                      const users = data.peerSelectionUsers ?? []
                      const currentUserId = data.currentUserId ?? ''
                      const isMultiMode = isMultiPeerSelectMode(m)
                      const filtered = users.filter((u) => u.user_id !== currentUserId)
                      // 타이핑하기 전에는 목록 비표시. 입력이 있을 때만 검색 결과를 스크롤 창으로 표시
                      const hasSearch = peerSearch.trim().length > 0
                      const list = hasSearch
                        ? filtered.filter(
                            (u) =>
                              (u.name ?? '').toLowerCase().includes(peerSearch.toLowerCase()) ||
                              (u.email ?? '').toLowerCase().includes(peerSearch.toLowerCase()) ||
                              (u.dept_name ?? '').toLowerCase().includes(peerSearch.toLowerCase())
                          )
                        : []
                      // 검색 결과 내 팀(부서) 묶음을 계산해 팀 단위 선택을 지원합니다.
                      const deptBuckets = new Map<string, PeerSelectionUserRow[]>()
                      for (const user of list) {
                        const dept = user.dept_name?.trim() || '미지정'
                        const bucket = deptBuckets.get(dept) ?? []
                        bucket.push(user)
                        deptBuckets.set(dept, bucket)
                      }
                      const searchedDeptEntries = [...deptBuckets.entries()]
                        .sort((a, b) => b[1].length - a[1].length)
                      const selectedPeerIds = parsePeerSelectPayload(m.method_id).peer_user_ids
                      const peerLabel = (u: PeerSelectionUserRow) =>
                        [u.name || '이름 없음', u.dept_name, u.email].filter(Boolean).join(' · ')
                      // 제목은 사용자 행동이 바로 보이도록 고정 문구를 사용합니다.
                      const displayLabel = '칭찬 대상 추가'
                      const peerSearchPlaceholder = resolveInputPlaceholder(
                        m,
                        isMultiMode
                          ? '이름/이메일/팀명 검색 후 대상 추가'
                          : '이름/이메일/팀명 검색 후 대상 1명 추가'
                      )
                      return (
                        <div key={m.method_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                          <label className="mb-2 block text-sm font-bold text-gray-800">
                            {displayLabel}
                          </label>
                          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                            메달 자동 지급을 위해 칭찬 대상을 반드시 추가해주세요.
                          </div>
                          {m.instruction?.trim() && (
                            <p className="mb-2 text-xs text-gray-500">{m.instruction.trim()}</p>
                          )}
                          {(() => {
                            const peerSelect = parsePeerSelectPayload(m.method_id)
                            const selectedPeers = filtered.filter((u) =>
                              peerSelect.peer_user_ids.includes(u.user_id)
                            )
                            return (
                              <>
                                <input
                                  type="text"
                                  value={peerSearch}
                                  onChange={(e) => setPeerSearch(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key !== 'Enter') return
                                    e.preventDefault()
                                    const firstMatch = list[0]
                                    if (!firstMatch) return
                                    if (!peerSelect.peer_user_ids.includes(firstMatch.user_id)) {
                                      updatePeerSelectPayload(m.method_id, (prev) => ({
                                        ...prev,
                                        peer_user_ids: isMultiMode
                                          ? [...prev.peer_user_ids, firstMatch.user_id]
                                          : [firstMatch.user_id],
                                      }))
                                    }
                                    // 연속 선택 UX: 엔터로 추가 후 바로 다음 검색 가능하도록 입력어를 비웁니다.
                                    setPeerSearch('')
                                  }}
                                  placeholder={peerSearchPlaceholder}
                                  className={inputClass}
                                  autoComplete="off"
                                />
                                {hasSearch && searchedDeptEntries.length > 0 && (
                                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                                    <p className="mb-2 text-xs font-semibold text-gray-600">검색된 팀 선택</p>
                                    <div className="flex flex-wrap gap-2">
                                      {searchedDeptEntries.map(([dept, deptUsers]) => {
                                        const deptIds = deptUsers.map((u) => u.user_id)
                                        const selectedCount = deptIds.filter((id) => selectedPeerIds.includes(id)).length
                                        const isTeamFullySelected = deptIds.length > 0 && selectedCount === deptIds.length
                                        return (
                                          <button
                                            key={dept}
                                            type="button"
                                            onClick={() =>
                                              updatePeerSelectPayload(m.method_id, (prev) => {
                                                if (!isMultiMode) {
                                                  return {
                                                    ...prev,
                                                    peer_user_ids: deptIds[0] ? [deptIds[0]] : prev.peer_user_ids,
                                                  }
                                                }
                                                return {
                                                  ...prev,
                                                  peer_user_ids: isTeamFullySelected
                                                    ? prev.peer_user_ids.filter((id) => !deptIds.includes(id))
                                                    : [...new Set([...prev.peer_user_ids, ...deptIds])],
                                                }
                                              })
                                            }
                                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                              isTeamFullySelected
                                                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                                : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800'
                                            }`}
                                          >
                                            {isTeamFullySelected ? '✓ ' : ''}
                                            {dept} ({deptUsers.length})
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                                {hasSearch && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updatePeerSelectPayload(m.method_id, (prev) => {
                                          const resultIds = list.map((u) => u.user_id)
                                          if (!isMultiMode) {
                                            return {
                                              ...prev,
                                              peer_user_ids: resultIds[0] ? [resultIds[0]] : prev.peer_user_ids,
                                            }
                                          }
                                          return {
                                            ...prev,
                                            peer_user_ids: [...new Set([...prev.peer_user_ids, ...resultIds])],
                                          }
                                        })
                                      }
                                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                                    >
                                      검색 결과 전체 선택 ({list.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updatePeerSelectPayload(m.method_id, (prev) => ({
                                          ...prev,
                                          peer_user_ids: isMultiMode
                                            ? prev.peer_user_ids.filter((id) => !list.some((u) => u.user_id === id))
                                            : [],
                                        }))
                                      }
                                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                      검색 결과 해제
                                    </button>
                                    {isMultiMode && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updatePeerSelectPayload(m.method_id, (prev) => ({
                                            ...prev,
                                            peer_user_ids: [],
                                          }))
                                        }
                                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                      >
                                        전체 선택 초기화
                                      </button>
                                    )}
                                  </div>
                                )}
                                {selectedPeers.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedPeers.map((u) => (
                                      <button
                                        key={u.user_id}
                                        type="button"
                                        onClick={() =>
                                          updatePeerSelectPayload(m.method_id, (prev) => ({
                                            ...prev,
                                            peer_user_ids: prev.peer_user_ids.filter((id) => id !== u.user_id),
                                          }))
                                        }
                                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                                      >
                                        {peerLabel(u)} ×
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {!hasSearch ? (
                                  <p className="mt-2 text-xs text-gray-500">
                                    이름/이메일/팀명 검색으로 대상자를 추가하세요.
                                  </p>
                                ) : (
                                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                                    {list.length === 0 ? (
                                      <p className="px-4 py-3 text-sm text-amber-600">
                                        검색 결과가 없습니다.
                                      </p>
                                    ) : (
                                      <ul className="py-1">
                                        {list.map((u) => {
                                          const isSelected = peerSelect.peer_user_ids.includes(u.user_id)
                                          return (
                                            <li key={u.user_id}>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updatePeerSelectPayload(m.method_id, (prev) => ({
                                                    ...prev,
                                                    peer_user_ids: isSelected
                                                      ? prev.peer_user_ids.filter((id) => id !== u.user_id)
                                                      : isMultiMode
                                                        ? [...prev.peer_user_ids, u.user_id]
                                                        : [u.user_id],
                                                  }))
                                                }
                                                className={`w-full px-4 py-2.5 text-left text-sm ${
                                                  isSelected
                                                    ? 'bg-emerald-50 font-semibold text-emerald-800'
                                                    : 'text-gray-800 hover:bg-green-50 hover:text-green-800'
                                                }`}
                                              >
                                                {isSelected ? '✓ ' : ''}
                                                {peerLabel(u)}
                                              </button>
                                            </li>
                                          )
                                        })}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                          <label className="mt-4 flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isAnonymous}
                              onChange={(e) => setIsAnonymous(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">익명으로 칭찬 보내기 (칭찬 받는 분에게는 익명으로 표시되며, 관리자는 제출자 확인 가능)</span>
                          </label>
                        </div>
                      )
                    }
                    const raw = formData[m.method_id] ?? ''
                    const isChoice = m.input_style === 'CHOICE'
                    const choiceOptions = (m.options ?? []).filter((o) => typeof o === 'string' && o.trim())
                    return (
                        <div key={m.method_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <label className="mb-2 block text-sm font-bold text-gray-800">
                          {m.label?.trim() || METHOD_LABEL[m.method_type]}
                        </label>
                        {m.instruction?.trim() && (
                          <p className="mb-2 text-xs text-gray-500">{m.instruction.trim()}</p>
                        )}
                        {isChoice ? (
                          <div className="space-y-2">
                            {choiceOptions.map((opt) => (
                              <label
                                key={opt}
                                className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:border-green-300 hover:bg-green-50/30 has-[:checked]:border-green-500 has-[:checked]:bg-green-50/50"
                              >
                                <input
                                  type="radio"
                                  name={m.method_id}
                                  value={opt}
                                  checked={raw === opt}
                                  onChange={() =>
                                    setFormData((prev) => ({ ...prev, [m.method_id]: opt }))
                                  }
                                  className="h-4 w-4 border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm font-medium text-gray-800">{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : isShort ? (
                          <input
                            type="text"
                            value={raw}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                [m.method_id]: e.target.value,
                              }))
                            }
                            className={inputClass}
                            placeholder={resolveInputPlaceholder(m)}
                          />
                        ) : (
                          <textarea
                            value={formData[m.method_id] ?? ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [m.method_id]: e.target.value }))
                            }
                            rows={3}
                            className={inputClass}
                            placeholder={resolveInputPlaceholder(m)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </form>
        )}

        {/* 예외 안전 가드: 데이터 상태가 비정상일 때 빈 화면 대신 안내를 표시 */}
        {!loading && !success && !data && (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-4">
            <p className="text-sm text-gray-600">
              인증 정보를 불러오지 못했습니다. 다시 시도해주세요.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        )}
        </div>

        {/* 폼일 때만 푸터 고정 (취소/제출) */}
        {!loading && data && !success && !cannotParticipateAlways && (
          <div className="flex-shrink-0 border-t border-gray-100 p-6 pt-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border-2 border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                form="event-verify-form"
                disabled={submitPending || data.verificationMethods.length === 0}
                className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed btn-press"
              >
                {submitPending ? '제출 중…' : '인증 제출'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
