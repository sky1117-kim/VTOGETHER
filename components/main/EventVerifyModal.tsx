'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { getEventForParticipationAction, submitEventSubmission, uploadEventVerificationPhoto, claimRewardChoice } from '@/api/actions/events'
import { uploadEventPhotoClient } from '@/lib/upload-event-photo'
import type { VerificationMethodRow, RoundForParticipation, RewardOptionRow, PeerSelectionUserRow } from '@/api/queries/events'
import { Skeleton } from '@/components/ui/skeleton'

const METHOD_LABEL: Record<string, string> = {
  PHOTO: '사진',
  TEXT: '텍스트',
  VALUE: '숫자',
  PEER_SELECT: '동료 선택',
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20'

/** 숫자 추출: 콤마(천 단위) 제거, 소수점(.) 하나만 허용 */
function parseNumberInput(value: string): string {
  let s = value.replace(/,/g, '')
  s = s.replace(/[^\d.]/g, '')
  const firstPeriod = s.indexOf('.')
  if (firstPeriod === -1) return s
  return s.slice(0, firstPeriod + 1) + s.slice(firstPeriod + 1).replace(/\./g, '')
}

/** 천 단위 콤마 포맷 (표시용). 소수점 있으면 그대로 유지 */
function formatNumberDisplay(value: string): string {
  const parsed = parseNumberInput(value)
  if (parsed === '') return ''
  const [intPart, decPart] = parsed.split('.')
  const formatted = Number(intPart || 0).toLocaleString('ko-KR')
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted
}

const ROUND_STATUS_LABEL: Record<string, string> = {
  OPEN: '인증 가능',
  LOCKED: '미오픈',
  SUBMITTED: '승인 대기중',
  APPROVED: '보상 대기',
  DONE: '완료',
  FAILED: '마감',
}
const REWARD_KIND_LABEL: Record<string, string> = {
  V_CREDIT: 'V.Credit',
  COFFEE_COUPON: '커피 쿠폰',
  GOODS: '굿즈',
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
    rewardOptions: RewardOptionRow[]
    pendingChoiceSubmission: { submission_id: string; round_number: number | null } | null
    canParticipate?: { allowed: boolean; reason?: string; nextAvailableAt?: string }
    peerSelectionUsers?: PeerSelectionUserRow[]
    currentUserId?: string | null
  } | null>(null)
  const [peerSearch, setPeerSearch] = useState('')
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  /** PHOTO 인증 방식: method_id별 업로드된 사진 URL 배열 (2장 이상 필수) */
  const [photoUrlsByMethod, setPhotoUrlsByMethod] = useState<Record<string, string[]>>({})
  /** 칭찬 챌린지(PEER_SELECT) 시 익명으로 칭찬 보내기 선택 여부 */
  const [isAnonymous, setIsAnonymous] = useState(false)
  /** 숫자(VALUE) 인증 필드별 에러 (숫자 아닌 문자 입력 시) */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [choicePending, setChoicePending] = useState(false)
  /** 보상 선택 후 확인 대기 (이걸로 하시겠어요?) */
  const [confirmingReward, setConfirmingReward] = useState<'V_CREDIT' | 'COFFEE_COUPON' | 'GOODS' | null>(null)

  // 모달/이벤트 변경 시 최신 값 유지 (늦게 도착한 응답 무시용)
  const latestRef = useRef({ isOpen, eventId })
  latestRef.current = { isOpen, eventId }

  useEffect(() => {
    if (!isOpen || !eventId) {
      setData(null)
      setError(null)
      setSuccess(false)
      setFormData({})
      setPhotoUrlsByMethod({})
      setFieldErrors({})
      setSelectedRoundId(null)
      setPeerSearch('')
      setConfirmingReward(null)
      setIsAnonymous(false)
      return
    }
    const fetchingFor = eventId
    setLoading(true)
    setError(null)
    getEventForParticipationAction(eventId)
      .then((res) => {
        // 모달 닫았거나 다른 이벤트 선택 시 응답 무시 (경쟁 상태 방지)
        if (latestRef.current.eventId !== fetchingFor || !latestRef.current.isOpen) return
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
        if (latestRef.current.eventId === fetchingFor && latestRef.current.isOpen) {
          setLoading(false)
        }
      })
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
        const { [methodId]: _, ...rest } = prev
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
    let peerUserId: string | null = null
    for (const m of data.verificationMethods) {
      if (m.method_type === 'PEER_SELECT') {
        const peer = formData[m.method_id + '_peer']?.trim() ?? ''
        if (!peer) missing.push('동료 선택')
        verificationData[m.method_id] = peer
        if (peer) peerUserId = peer
      } else if (m.method_type === 'PHOTO') {
        const urls = photoUrlsByMethod[m.method_id] ?? []
        if (urls.length < 2) missing.push('사진 (2장 이상)')
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
    setSubmitPending(true)
    setError(null)
    const result = await submitEventSubmission(eventId, roundId, verificationData, peerUserId ?? undefined, isAnonymous)
    setSubmitPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSuccess(true)
    onSuccess?.()
    setTimeout(() => onClose(), 1500)
  }

  const handleRewardChoice = async (rewardKind: 'V_CREDIT' | 'COFFEE_COUPON' | 'GOODS') => {
    if (!data?.pendingChoiceSubmission) return
    setChoicePending(true)
    setError(null)
    const result = await claimRewardChoice(data.pendingChoiceSubmission.submission_id, rewardKind)
    setChoicePending(false)
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

  const showRewardChoice = data?.pendingChoiceSubmission && data.rewardOptions?.length > 0
  const cannotParticipateAlways = data?.event.type === 'ALWAYS' && data.canParticipate && !data.canParticipate.allowed

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      {/* 큰 폼 기준 고정 크기 — 로딩↔로드 시 크기 변화 없음. 짧은 내용은 본문에서 중앙 배치 */}
      <div
        className="relative z-10 flex h-[65vh] min-h-[500px] max-h-[720px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 고정 */}
        <div className="flex-shrink-0 border-b border-gray-100 p-6 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">이벤트 인증</h3>
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

        {/* 본문: 스크롤 가능, 짧은 내용일 땐 flex로 중앙 배치 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-6 pt-4">
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
        {!loading && data && !success && data.pendingChoiceSubmission && data.rewardOptions.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <p className="text-center text-base font-semibold text-gray-800">{data.event.title}</p>
            <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
              승인되었으나 보상 옵션이 설정되지 않았습니다. 관리자에게 문의하세요.
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
        {!loading && data && !success && showRewardChoice && (
          <div className="flex flex-1 flex-col justify-center space-y-6">
            {confirmingReward == null ? (
              <>
                <p className="text-base font-semibold text-gray-800">{data.event.title}</p>
                {data.pendingChoiceSubmission?.round_number != null && (
                  <p className="text-sm text-gray-600">{data.pendingChoiceSubmission.round_number}구간 승인됨 · 받을 보상을 선택하세요.</p>
                )}
                {!data.pendingChoiceSubmission?.round_number && (
                  <p className="text-sm text-gray-600">승인되었습니다. 받을 보상을 선택하세요.</p>
                )}
                <div className="flex flex-col gap-2">
                  {data.rewardOptions.map((opt) => (
                    <button
                      key={opt.reward_kind}
                      type="button"
                      disabled={choicePending}
                      onClick={() => setConfirmingReward(opt.reward_kind)}
                      className="rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-800 transition hover:border-green-400 hover:bg-green-50 disabled:opacity-50"
                    >
                      {REWARD_KIND_LABEL[opt.reward_kind] ?? opt.reward_kind}
                      {opt.reward_kind === 'V_CREDIT' && opt.amount != null && (
                        <span className="ml-2 text-green-600"> {opt.amount} P</span>
                      )}
                      {opt.reward_kind === 'COFFEE_COUPON' && opt.amount != null && (
                        <span className="ml-2 text-green-600"> {opt.amount}매</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-gray-800">이걸로 하시겠어요?</p>
                <div className="rounded-xl border-2 border-green-200 bg-green-50/50 px-4 py-3">
                  <p className="text-sm font-medium text-gray-800">
                    {REWARD_KIND_LABEL[confirmingReward] ?? confirmingReward}
                    {confirmingReward === 'V_CREDIT' && (() => {
                      const opt = data.rewardOptions.find((o) => o.reward_kind === 'V_CREDIT')
                      return opt?.amount != null ? ` ${opt.amount} P` : ''
                    })()}
                    {confirmingReward === 'COFFEE_COUPON' && (() => {
                      const opt = data.rewardOptions.find((o) => o.reward_kind === 'COFFEE_COUPON')
                      return opt?.amount != null ? ` ${opt.amount}매` : ''
                    })()}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">선택 후에는 변경할 수 없습니다.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmingReward(null)}
                    className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    다시 선택
                  </button>
                  <button
                    type="button"
                    disabled={choicePending}
                    onClick={() => confirmingReward && handleRewardChoice(confirmingReward)}
                    className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 btn-press"
                  >
                    {choicePending ? '처리 중…' : '이걸로 받기'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && data && !success && !showRewardChoice && cannotParticipateAlways && (
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

        {!loading && data && !success && !showRewardChoice && !cannotParticipateAlways && (
          <form id="event-verify-form" onSubmit={handleSubmit} className="space-y-6">
            <p className="text-base font-semibold text-gray-800">{data.event.title}</p>

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
                        <div
                          key={m.method_id}
                          className="rounded-xl border border-gray-200 bg-gray-50/30 p-4"
                        >
                          <label className="mb-2 block text-sm font-bold text-gray-800">
                            {m.label?.trim() || m.instruction?.trim() || '사진을 첨부해 주세요'}
                            <span className="ml-1 font-normal text-amber-600">(2장 이상 필수)</span>
                          </label>
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
                              ✓ {urls.length}장 첨부됨 {urls.length < 2 && '(2장 이상 필요)'}
                            </p>
                          )}
                        </div>
                      )
                    }
                    if (m.method_type === 'VALUE') {
                      const raw = formData[m.method_id] ?? ''
                      const valueError = fieldErrors[m.method_id]
                      return (
                        <div
                          key={m.method_id}
                          className="rounded-xl border border-gray-200 bg-gray-50/30 p-4"
                        >
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
                            value={raw === '' ? '' : formatNumberDisplay(raw)}
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
                                [m.method_id]: parseNumberInput(input),
                              }))
                            }}
                            className={`${inputClass} ${valueError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                            placeholder={m.unit ? `숫자 입력 (콤마·소수점 가능) ${m.unit}` : '숫자 입력 (콤마·소수점 가능)'}
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
                      const peerLabel = (u: PeerSelectionUserRow) =>
                        [u.name || '이름 없음', u.dept_name, u.email].filter(Boolean).join(' · ')
                      const selectedPeerId = formData[m.method_id + '_peer'] ?? ''
                      const selectedPeer = selectedPeerId
                        ? filtered.find((u) => u.user_id === selectedPeerId)
                        : null
                      // 제목(label): 관리자가 설정한 값 사용. 비우면 방식명(동료 선택) fallback
                      const displayLabel = (m.label?.trim() || METHOD_LABEL[m.method_type])
                      return (
                        <div
                          key={m.method_id}
                          className="rounded-xl border border-gray-200 bg-gray-50/30 p-4"
                        >
                          <label className="mb-2 block text-sm font-bold text-gray-800">
                            {displayLabel}
                            {m.instruction?.trim() && (
                              <span className="ml-1 font-normal text-gray-500">— {m.instruction.trim()}</span>
                            )}
                          </label>
                          {selectedPeer ? (
                            <div className="mb-3 flex items-center justify-between rounded-xl border border-green-200 bg-green-50/50 px-4 py-3">
                              <span className="text-sm font-medium text-gray-800">
                                선택됨: {peerLabel(selectedPeer)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, [m.method_id + '_peer']: '' }))
                                  setPeerSearch('')
                                }}
                                className="text-xs font-medium text-green-600 hover:underline"
                              >
                                변경
                              </button>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={peerSearch}
                                onChange={(e) => setPeerSearch(e.target.value)}
                                placeholder="이름·이메일·부서로 검색하면 동료 목록이 나옵니다"
                                className={inputClass}
                                autoComplete="off"
                              />
                              {!hasSearch ? (
                                <p className="mt-2 text-xs text-gray-500">
                                  검색어를 입력하면 동료 목록이 스크롤 창으로 나타납니다.
                                </p>
                              ) : (
                                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                                  {list.length === 0 ? (
                                    <p className="px-4 py-3 text-sm text-amber-600">
                                      검색 결과가 없습니다. 이름·이메일·부서를 입력해보세요.
                                    </p>
                                  ) : (
                                    <ul className="py-1">
                                      {list.map((u) => (
                                        <li key={u.user_id}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFormData((prev) => ({ ...prev, [m.method_id + '_peer']: u.user_id }))
                                              setPeerSearch('')
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-green-50 hover:text-green-800"
                                          >
                                            {peerLabel(u)}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </>
                          )}
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
                      <div
                        key={m.method_id}
                        className="rounded-xl border border-gray-200 bg-gray-50/30 p-4"
                      >
                        <label className="mb-2 block text-sm font-bold text-gray-800">
                          {(m.label?.trim() || m.instruction?.trim() || m.placeholder?.trim()) ?? '입력하세요'}
                        </label>
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
                            placeholder={m.placeholder ?? '입력하세요'}
                          />
                        ) : (
                          <textarea
                            value={formData[m.method_id] ?? ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [m.method_id]: e.target.value }))
                            }
                            rows={3}
                            className={inputClass}
                            placeholder={m.placeholder ?? '입력하세요'}
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
        </div>

        {/* 폼일 때만 푸터 고정 (취소/제출) */}
        {!loading && data && !success && !showRewardChoice && !cannotParticipateAlways && (
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
