'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getEventForParticipationAction, submitEventSubmission, uploadEventVerificationPhoto, claimRewardChoice } from '@/api/actions/events'
import type { VerificationMethodRow, RoundForParticipation, RewardOptionRow, PeerSelectionUserRow } from '@/api/queries/events'

const METHOD_LABEL: Record<string, string> = {
  PHOTO: '사진',
  TEXT: '텍스트',
  VALUE: '숫자',
  PEER_SELECT: '동료 선택 + 텍스트',
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20'
const ROUND_STATUS_LABEL: Record<string, string> = {
  OPEN: '인증 가능',
  LOCKED: '미오픈',
  SUBMITTED: '승인 대기중',
  APPROVED: '보상 대기',
  DONE: '완료',
  FAILED: '마감',
}
const REWARD_KIND_LABEL: Record<string, string> = {
  V_POINT: 'V.Point',
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
  const [choicePending, setChoicePending] = useState(false)
  /** 보상 선택 후 확인 대기 (이걸로 하시겠어요?) */
  const [confirmingReward, setConfirmingReward] = useState<'V_POINT' | 'COFFEE_COUPON' | 'GOODS' | null>(null)

  useEffect(() => {
    if (!isOpen || !eventId) {
      setData(null)
      setError(null)
      setSuccess(false)
      setFormData({})
      setSelectedRoundId(null)
      setPeerSearch('')
      setConfirmingReward(null)
      return
    }
    setLoading(true)
    setError(null)
    getEventForParticipationAction(eventId)
      .then((res) => {
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
      .finally(() => setLoading(false))
  }, [isOpen, eventId])

  const handlePhotoChange = async (methodId: string, file: File | null) => {
    if (!file) {
      setFormData((prev) => ({ ...prev, [methodId]: '' }))
      return
    }
    setUploadingId(methodId)
    setError(null)
    const fd = new FormData()
    fd.set('file', file)
    const result = await uploadEventVerificationPhoto(fd)
    setUploadingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.url) setFormData((prev) => ({ ...prev, [methodId]: result.url! }))
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
        const text = formData[m.method_id]?.trim() ?? ''
        const peer = formData[m.method_id + '_peer']?.trim() ?? ''
        if (!peer) missing.push('동료 선택')
        if (!text) missing.push('칭찬 메시지')
        verificationData[m.method_id] = text
        if (peer) peerUserId = peer
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
    setSubmitPending(true)
    setError(null)
    const result = await submitEventSubmission(eventId, roundId, verificationData, peerUserId ?? undefined)
    setSubmitPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSuccess(true)
    onSuccess?.()
    setTimeout(() => onClose(), 1500)
  }

  const handleRewardChoice = async (rewardKind: 'V_POINT' | 'COFFEE_COUPON' | 'GOODS') => {
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

  if (!isOpen) return null

  const showRewardChoice = data?.pendingChoiceSubmission && data.rewardOptions?.length > 0
  const cannotParticipateAlways = data?.event.type === 'ALWAYS' && data.canParticipate && !data.canParticipate.allowed

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
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

        {loading && <p className="py-8 text-center text-sm text-gray-500">불러오는 중…</p>}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            제출되었습니다. 심사 후 보상이 지급됩니다.
          </div>
        )}
        {!loading && data && !success && showRewardChoice && (
          <div className="space-y-6">
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
                      {opt.reward_kind === 'V_POINT' && opt.amount != null && (
                        <span className="ml-2 text-green-600"> {opt.amount} P</span>
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
                    {confirmingReward === 'V_POINT' && (() => {
                      const opt = data.rewardOptions.find((o) => o.reward_kind === 'V_POINT')
                      return opt?.amount != null ? ` ${opt.amount} P` : ''
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
                    className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {choicePending ? '처리 중…' : '이걸로 받기'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && data && !success && !showRewardChoice && cannotParticipateAlways && (
          <div className="space-y-4">
            <p className="text-base font-semibold text-gray-800">{data.event.title}</p>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
        )}

        {!loading && data && !success && !showRewardChoice && !cannotParticipateAlways && (
          <form onSubmit={handleSubmit} className="space-y-6">
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
                      return (
                        <div
                          key={m.method_id}
                          className="rounded-xl border border-gray-200 bg-gray-50/30 p-4"
                        >
                          <label className="mb-2 block text-sm font-bold text-gray-800">
                            {METHOD_LABEL[m.method_type]}
                            {m.instruction && (
                              <span className="ml-1 font-normal text-gray-500">— {m.instruction}</span>
                            )}
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handlePhotoChange(m.method_id, e.target.files?.[0] ?? null)
                            }
                            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-green-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:hover:bg-green-600"
                          />
                          {uploadingId === m.method_id && (
                            <p className="mt-2 text-xs text-gray-500">업로드 중…</p>
                          )}
                          {formData[m.method_id] && (
                            <p className="mt-2 text-xs font-medium text-green-600">✓ 첨부 완료</p>
                          )}
                        </div>
                      )
                    }
                    if (m.method_type === 'VALUE') {
                      return (
                        <div
                          key={m.method_id}
                          className="rounded-xl border border-gray-200 bg-gray-50/30 p-4"
                        >
                          <label className="mb-2 block text-sm font-bold text-gray-800">
                            {METHOD_LABEL[m.method_type]}
                            {m.instruction && (
                              <span className="ml-1 font-normal text-gray-500">— {m.instruction}</span>
                            )}
                          </label>
                          <input
                            type="number"
                            value={formData[m.method_id] ?? ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [m.method_id]: e.target.value }))
                            }
                            className={inputClass}
                            placeholder={m.placeholder ?? '숫자 입력'}
                          />
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
                      return (
                        <div
                          key={m.method_id}
                          className="rounded-xl border border-gray-200 bg-gray-50/30 p-4"
                        >
                          <label className="mb-2 block text-sm font-bold text-gray-800">
                            {METHOD_LABEL[m.method_type]}
                            {m.instruction && (
                              <span className="ml-1 font-normal text-gray-500">— {m.instruction}</span>
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
                          <label className="mt-4 mb-2 block text-sm font-bold text-gray-800">
                            칭찬 메시지
                          </label>
                          <textarea
                            value={formData[m.method_id] ?? ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [m.method_id]: e.target.value }))
                            }
                            rows={3}
                            className={inputClass}
                            placeholder="칭찬 메시지를 입력하세요"
                          />
                        </div>
                      )
                    }
                    return (
                      <div
                        key={m.method_id}
                        className="rounded-xl border border-gray-200 bg-gray-50/30 p-4"
                      >
                        <label className="mb-2 block text-sm font-bold text-gray-800">
                          {METHOD_LABEL[m.method_type]}
                          {m.instruction && (
                            <span className="ml-1 font-normal text-gray-500">— {m.instruction}</span>
                          )}
                        </label>
                        {isShort ? (
                          <input
                            type="text"
                            value={formData[m.method_id] ?? ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [m.method_id]: e.target.value }))
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

            <div className="flex gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border-2 border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitPending || data.verificationMethods.length === 0}
                className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitPending ? '제출 중…' : '인증 제출'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
