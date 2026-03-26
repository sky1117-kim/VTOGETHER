'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { createEvent, createRoundsForMonth, getEventForCopy } from '@/api/actions/admin/events'
import { uploadEventRepresentativeImage } from '@/api/actions/events'
import type { VerificationMethodInput, EventRewardInput, EventRow } from '@/api/actions/admin/events'
import {
  EVENT_CATEGORIES,
  EVENT_TYPES,
  FREQUENCY_LIMITS,
  REWARD_POLICIES,
  VERIFICATION_METHOD_TYPES,
  VALUE_LABEL_OPTIONS,
  VALUE_LABEL_CUSTOM,
  VALUE_UNIT_OPTIONS,
  VALUE_UNIT_CUSTOM,
} from '@/constants/events'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

// 입력 필드: 부드러운 테두리, 포커스 시 primary 강조
const inputClass =
  'mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-gray-900 transition-colors placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20'
const labelClass = 'block text-sm font-semibold text-gray-800'

type VerificationMethodType = VerificationMethodInput['method_type']

/** 인증 항목 1개 (타입 + 제목 + 직원 안내문 + 단답/장문/객관식 또는 단위) */
interface VerificationItem {
  id: string
  method_type: VerificationMethodType
  /** 모든 방식 공통. 심사 시 "(제목) - 제출답변" 형태로 표시. 비우면 방식명(사진/텍스트 등) 사용 */
  label?: string
  instruction: string
  /** TEXT용. VALUE는 숫자만 입력되므로 사용 안 함 */
  input_style: 'SHORT' | 'LONG' | 'CHOICE'
  /** 객관식(CHOICE)일 때만. 관리자가 정한 선택지 배열 */
  options?: string[]
  /** VALUE용. 단위 (예: km/h, km). 선택 또는 직접 입력 */
  unit?: string
}

function buildPayload(
  state: {
    title: string
    shortDescription: string
    description: string
    imageUrl: string
    category: 'CULTURE' | 'PEOPLE'
    type: 'ALWAYS' | 'SEASONAL'
    frequencyLimit: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
    rewardPolicy: 'SENDER_ONLY' | 'BOTH'
    rewardAmount: string
    verificationItems: VerificationItem[]
  }
) {
  const rewardKind: EventRewardInput['reward_kind'] = state.category === 'PEOPLE' ? 'V_MEDAL' : 'V_CREDIT'
  const rewards: EventRewardInput[] = [
    {
      reward_kind: rewardKind,
      amount: Math.max(0, parseInt(state.rewardAmount, 10) || 0),
    },
  ]
  const verification_methods: VerificationMethodInput[] = state.verificationItems.map((item) => ({
    method_type: item.method_type,
    is_required: true,
    instruction: item.instruction.trim() || null,
    input_style: item.method_type === 'PHOTO' ? null : item.method_type === 'VALUE' ? null : item.method_type === 'PEER_SELECT' ? null : item.input_style,
    options: item.input_style === 'CHOICE' && Array.isArray(item.options) ? item.options.filter(Boolean) : null,
    // 제목(label): 모든 방식 공통. VALUE는 항목명(거리/속도 등), 그 외는 사용자 입력 제목. 심사 시 "(제목) - 제출답변" 표시
    label:
      item.method_type === 'VALUE'
        ? item.label && item.label !== VALUE_LABEL_CUSTOM
          ? (item.label.trim() || null)
          : null
        : (item.label?.trim() || null),
    unit:
      item.method_type === 'VALUE'
        ? item.unit === VALUE_UNIT_CUSTOM
          ? null
          : (item.unit?.trim() || null)
        : null,
  }))
  return {
    title: state.title.trim(),
    short_description: state.shortDescription.trim() || null,
    description: state.description.trim() || null,
    image_url: state.imageUrl.trim() || null,
    category: state.category,
    type: state.type,
    reward_policy: state.rewardPolicy,
    rewards,
    status: 'ACTIVE' as const,
    frequency_limit: state.type === 'ALWAYS' ? state.frequencyLimit : null,
    verification_methods,
  }
}

/** 드래그 가능한 인증 항목 카드 */
function SortableVerificationItem({
  item,
  onRemove,
  onInstructionChange,
  onInputStyleChange,
  onLabelChange,
  onUnitChange,
  onOptionsChange,
  inputClass,
}: {
  item: VerificationItem
  index?: number
  onRemove: (id: string) => void
  onInstructionChange: (id: string, instruction: string) => void
  onInputStyleChange: (id: string, input_style: 'SHORT' | 'LONG' | 'CHOICE') => void
  onLabelChange: (id: string, label: string) => void
  onUnitChange: (id: string, unit: string) => void
  onOptionsChange: (id: string, options: string[]) => void
  inputClass: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const methodLabel = VERIFICATION_METHOD_TYPES.find((m) => m.value === item.method_type)?.label ?? item.method_type

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${isDragging ? 'opacity-60 shadow-lg ring-2 ring-emerald-200' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:cursor-grabbing"
          aria-label="순서 변경"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {methodLabel}
          </span>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 hover:border-red-300"
          >
            삭제
          </button>
        </div>
      </div>
      {/* 제목: 모든 방식 공통. 심사 시 "(제목) - 제출답변" 형태로 표시. 비우면 방식명(사진/텍스트 등) 사용 */}
      <div>
        <label className="text-xs font-medium text-gray-500">제목 (심사 시 표시)</label>
        {item.method_type === 'VALUE' ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              value={
                item.label === VALUE_LABEL_CUSTOM ||
                (item.label && !VALUE_LABEL_OPTIONS.some((o) => o.value === item.label))
                  ? VALUE_LABEL_CUSTOM
                  : item.label ?? ''
              }
              onChange={(e) => {
                const v = e.target.value
                onLabelChange(item.id, v === VALUE_LABEL_CUSTOM ? VALUE_LABEL_CUSTOM : v)
              }}
              className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            >
              {VALUE_LABEL_OPTIONS.map((o) => (
                <option key={o.value || 'none'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {(item.label === VALUE_LABEL_CUSTOM ||
              (item.label && !VALUE_LABEL_OPTIONS.some((o) => o.value === item.label))) && (
              <input
                type="text"
                value={item.label === VALUE_LABEL_CUSTOM ? '' : (item.label ?? '')}
                onChange={(e) => onLabelChange(item.id, e.target.value)}
                placeholder="예: 평균속도"
                className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              />
            )}
          </div>
        ) : (
          <input
            type="text"
            value={item.label ?? ''}
            onChange={(e) => onLabelChange(item.id, e.target.value)}
            placeholder={`예: ${methodLabel} 인증`}
            className={inputClass}
          />
        )}
        <p className="mt-0.5 text-xs text-gray-400">비우면 &quot;{methodLabel}&quot;로 표시됩니다.</p>
      </div>
      {item.method_type === 'TEXT' && (
        <>
          <div>
            <label className="text-xs font-medium text-gray-500">입력 형태</label>
            <select
              value={item.input_style}
              onChange={(e) => onInputStyleChange(item.id, e.target.value as 'SHORT' | 'LONG' | 'CHOICE')}
              className="mt-1 w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            >
              <option value="SHORT">단답</option>
              <option value="LONG">장문</option>
              <option value="CHOICE">객관식</option>
            </select>
          </div>
          {item.input_style === 'CHOICE' && (
            <div>
              <label className="text-xs font-medium text-gray-500">선택지 (참여자가 고를 수 있는 옵션)</label>
              <p className="mt-0.5 mb-1 text-xs text-gray-400">+ 버튼으로 선택지를 추가하세요. 최소 2개 이상 필요합니다.</p>
              <div className="mt-1 space-y-2">
                {(item.options ?? ['', '']).map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...(item.options ?? ['', ''])]
                        next[idx] = e.target.value
                        onOptionsChange(item.id, next)
                      }}
                      placeholder={`선택지 ${idx + 1}`}
                      className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = (item.options ?? ['', '']).filter((_, i) => i !== idx)
                        if (next.length < 2) next.push('')
                        onOptionsChange(item.id, next)
                      }}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onOptionsChange(item.id, [...(item.options ?? ['', '']), ''])}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-100"
                >
                  + 선택지 추가
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {item.method_type === 'VALUE' && (
        <>
          <div>
            <label className="text-xs font-medium text-gray-500">단위 (선택 또는 직접 입력)</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              value={
                item.unit === VALUE_UNIT_CUSTOM ||
                (item.unit && !VALUE_UNIT_OPTIONS.some((o) => o.value === item.unit))
                  ? VALUE_UNIT_CUSTOM
                  : item.unit ?? ''
              }
              onChange={(e) => {
                const v = e.target.value
                onUnitChange(item.id, v === VALUE_UNIT_CUSTOM ? VALUE_UNIT_CUSTOM : v)
              }}
              className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            >
              {VALUE_UNIT_OPTIONS.map((o) => (
                <option key={o.value || 'none'} value={o.value}>
                  {o.label}
                </option>
              ))}
              <option value={VALUE_UNIT_CUSTOM}>직접 입력</option>
            </select>
            {(item.unit === VALUE_UNIT_CUSTOM ||
              (item.unit && !VALUE_UNIT_OPTIONS.some((o) => o.value === item.unit))) && (
              <input
                type="text"
                value={item.unit === VALUE_UNIT_CUSTOM ? '' : (item.unit ?? '')}
                onChange={(e) => onUnitChange(item.id, e.target.value)}
                placeholder="예: km/h, 마일"
                className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              />
            )}
          </div>
        </div>
          </>
        )}
      <div>
        <label className="text-xs font-medium text-gray-500">안내 문구</label>
        <textarea
          value={item.instruction}
          onChange={(e) => onInstructionChange(item.id, e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="직원에게 보여줄 안내 문구"
        />
      </div>
    </li>
  )
}

function validateForm(state: {
  title: string
  rewardAmount: string
  verificationItems: VerificationItem[]
}): string | null {
  if (!state.title.trim()) return '제목을 입력하세요.'
  if (!state.rewardAmount.trim() || parseInt(state.rewardAmount, 10) < 0) return '보상 수량을 입력하세요.'
  if (state.verificationItems.length === 0) return '인증 방식을 1개 이상 추가하세요.'
  for (const item of state.verificationItems) {
    if (item.method_type === 'TEXT' && item.input_style === 'CHOICE') {
      const validOpts = (item.options ?? []).filter((o) => o.trim())
      if (validOpts.length < 2) return '객관식 인증은 선택지를 2개 이상 입력해야 합니다.'
    }
  }
  return null
}

interface CreateEventFormProps {
  createdBy: string
  /** 기존 이벤트에서 복사할 때 선택할 목록 */
  existingEvents?: EventRow[]
}

export function CreateEventForm({ createdBy, existingEvents = [] }: CreateEventFormProps) {
  const router = useRouter()
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [copyEventId, setCopyEventId] = useState('')
  const [copyLoading, setCopyLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [category, setCategory] = useState<'CULTURE' | 'PEOPLE'>('CULTURE')
  const [type, setType] = useState<'ALWAYS' | 'SEASONAL'>('ALWAYS')
  const [frequencyLimit, setFrequencyLimit] = useState<'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('ONCE')
  const [rewardPolicy, setRewardPolicy] = useState<'SENDER_ONLY' | 'BOTH'>('SENDER_ONLY')
  const [rewardAmount, setRewardAmount] = useState('100')
  const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([])
  const now = new Date()
  const [roundYear, setRoundYear] = useState(now.getFullYear())
  const [roundMonth, setRoundMonth] = useState(now.getMonth() + 1)

  const addVerificationItem = (method_type: VerificationMethodType) => {
    const defaultStyle: 'SHORT' | 'LONG' = method_type === 'VALUE' ? 'SHORT' : 'LONG'
    setVerificationItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        method_type,
        instruction: '',
        input_style: defaultStyle,
        label: '',
        unit: method_type === 'VALUE' ? '' : undefined,
      },
    ])
  }

  const removeVerificationItem = (id: string) => {
    setVerificationItems((prev) => prev.filter((item) => item.id !== id))
  }

  /** 드래그로 인증 항목 순서 변경 */
  const reorderVerificationItems = (oldIndex: number, newIndex: number) => {
    setVerificationItems((prev) => arrayMove(prev, oldIndex, newIndex))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = verificationItems.findIndex((i) => i.id === active.id)
    const newIndex = verificationItems.findIndex((i) => i.id === over.id)
    if (oldIndex >= 0 && newIndex >= 0) reorderVerificationItems(oldIndex, newIndex)
  }

  const setVerificationInstruction = (id: string, instruction: string) => {
    setVerificationItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, instruction } : item))
    )
  }
  const setVerificationInputStyle = (id: string, input_style: 'SHORT' | 'LONG' | 'CHOICE') => {
    setVerificationItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, input_style, options: input_style === 'CHOICE' ? ['', ''] : undefined }
          : item
      )
    )
  }
  const setVerificationOptions = (id: string, options: string[]) => {
    setVerificationItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, options } : item))
    )
  }
  const setVerificationUnit = (id: string, unit: string) => {
    setVerificationItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unit } : item))
    )
  }
  const setVerificationLabel = (id: string, label: string) => {
    setVerificationItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, label } : item))
    )
  }

  /** 기존 이벤트를 선택해 폼에 불러오기 (수정 후 새로 등록) */
  async function handleCopyFromExisting() {
    if (!copyEventId) return
    setMessage(null)
    setCopyLoading(true)
    try {
      const { data, error } = await getEventForCopy(copyEventId)
      if (error || !data) {
        setMessage({ type: 'error', text: error ?? '불러오기 실패' })
        return
      }
      const { event: ev, rewards: revs, verification_methods: vms } = data
      setTitle(ev.title.trim() ? `${ev.title} (복사)` : '')
      setShortDescription(ev.short_description ?? '')
      setDescription(ev.description ?? '')
      setImageUrl(ev.image_url ?? '')
      setCategory(((ev as { category?: string }).category === 'PEOPLE' ? 'PEOPLE' : 'CULTURE'))
      setType(ev.type)
      setFrequencyLimit(ev.frequency_limit ?? 'ONCE')
      setRewardPolicy(ev.reward_policy)
      const currencyReward = revs.find((r) => r.reward_kind === 'V_MEDAL' || r.reward_kind === 'V_CREDIT')
      setRewardAmount(currencyReward?.amount != null ? String(currencyReward.amount) : '100')
      setVerificationItems(
        vms.map((m) => ({
          id: crypto.randomUUID(),
          method_type: m.method_type,
          instruction: m.instruction ?? '',
          input_style: (m.input_style === 'CHOICE' ? 'CHOICE' : m.input_style) ?? (m.method_type === 'VALUE' ? 'SHORT' : 'LONG'),
          label: m.label ?? '',
          unit: m.method_type === 'VALUE' ? (m.unit ?? '') : undefined,
          options: m.input_style === 'CHOICE' && Array.isArray(m.options) ? m.options : undefined,
        }))
      )
      setMessage({ type: 'ok', text: '기존 이벤트 내용을 불러왔습니다. 필요하면 수정 후 등록하세요.' })
    } finally {
      setCopyLoading(false)
    }
  }

  const state = {
    title,
    shortDescription,
    description,
    imageUrl,
    category,
    type,
    frequencyLimit,
    rewardPolicy,
    rewardAmount,
    verificationItems,
  }

  /** 대표 이미지 파일 업로드 후 URL 설정 */
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    setMessage(null)
    const fd = new FormData()
    fd.set('file', file)
    const result = await uploadEventRepresentativeImage(fd)
    setImageUploading(false)
    e.target.value = ''
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    if (result.url) setImageUrl(result.url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const error = validateForm(state)
    if (error) {
      setMessage({ type: 'error', text: error })
      return
    }
    setPending(true)
    const result = await createEvent(buildPayload(state), createdBy)
    if (result.error) {
      setPending(false)
      setMessage({ type: 'error', text: result.error })
      return
    }
    if (type === 'SEASONAL' && result.eventId) {
      const roundResult = await createRoundsForMonth(result.eventId, roundYear, roundMonth)
      if (roundResult.error) {
        setMessage({ type: 'error', text: `이벤트는 등록됐으나 구간 생성 실패: ${roundResult.error}` })
        setPending(false)
        return
      }
    }
    setPending(false)
    setMessage({ type: 'ok', text: '이벤트가 등록되었습니다.' })
    router.push('/admin/events')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            message.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/60'
              : 'bg-red-50 text-red-800 ring-1 ring-red-200/60'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 기존 이벤트 복사: 컴팩트한 보조 액션 */}
      {existingEvents.length > 0 && (
        <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-600">기존 이벤트에서 복사</span>
            <select
              value={copyEventId}
              onChange={(e) => setCopyEventId(e.target.value)}
              className="min-w-[220px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">이벤트 선택</option>
              {existingEvents.map((e) => (
                <option key={e.event_id} value={e.event_id}>
                  {e.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCopyFromExisting}
              disabled={!copyEventId || copyLoading}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copyLoading ? '불러오는 중…' : '불러오기'}
            </button>
          </div>
        </section>
      )}

      {/* 기본 정보 · 이벤트 설정 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-gray-900">기본 정보 · 이벤트 설정</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="예: 1월 걷기 챌린지"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>간단 문구 (카드·목록에 표시)</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className={inputClass}
              placeholder="예: 걷기 챌린지로 포인트를 받아보세요"
              maxLength={120}
            />
            <p className="mt-1.5 text-xs text-gray-500">한 줄 요약. 카드와 목록에만 보입니다. (최대 120자)</p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>대표 이미지 (선택)</label>
            <p className="mt-0.5 mb-1.5 text-xs text-gray-500">
              URL을 입력하거나 이미지 파일을 첨부하세요. 카드·목록에 표시됩니다.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className={`flex-1 min-w-[200px] ${inputClass}`}
                placeholder="https://..."
              />
              <label className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:border-gray-300">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageUpload}
                  disabled={imageUploading}
                  className="sr-only"
                />
                {imageUploading ? '업로드 중…' : '이미지 첨부'}
              </label>
            </div>
            {imageUrl.trim() && (
              <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <img
                  src={imageUrl}
                  alt="대표 이미지 미리보기"
                  className="max-h-40 w-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>전체 소개 (상세 보기)</label>
            <p className="mt-0.5 mb-1.5 text-xs text-gray-500">
              글자 선택 후 ⌘B(굵게)·⌘I(기울임) 또는 툴바 버튼으로 포맷을 적용할 수 있습니다.
            </p>
            <div className="mt-1.5">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="이벤트 상세 안내 문구. 클릭 시 팝업에 포맷 적용되어 표시됩니다."
              aria-label="전체 소개"
            />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">상세 보기 팝업에 표시되는 본문입니다.</p>
          </div>
          <div>
            <label className={labelClass}>카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'CULTURE' | 'PEOPLE')}
              className={inputClass}
            >
              {EVENT_CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="mt-2 text-xs font-medium text-emerald-700">
              자동 보상 안내: {category === 'PEOPLE' ? 'People 선택 시 V.Medal 지급' : 'Culture 선택 시 V.Credit 지급'}
            </p>
          </div>
          <div>
            <label className={labelClass}>타입</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'ALWAYS' | 'SEASONAL')}
              className={inputClass}
            >
              {EVENT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {type === 'ALWAYS' && (
            <div>
              <label className={labelClass}>참여 빈도</label>
              <select
                value={frequencyLimit}
                onChange={(e) => setFrequencyLimit(e.target.value as 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY')}
                className={inputClass}
              >
                {FREQUENCY_LIMITS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
          {type === 'SEASONAL' && (
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <span className="text-sm font-medium text-gray-600">구간 자동 생성</span>
              <select
                value={roundYear}
                onChange={(e) => setRoundYear(Number(e.target.value))}
                className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {[0, 1, 2, 3, 4].map((i) => {
                  const y = now.getFullYear() + i
                  return <option key={y} value={y}>{y}년</option>
                })}
              </select>
              <select
                value={roundMonth}
                onChange={(e) => setRoundMonth(Number(e.target.value))}
                className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">→ 등록 시 3구간 생성</span>
            </div>
          )}
        </div>
      </section>

      {/* 보상 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-gray-900">보상</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={labelClass}>보상 정책</label>
            <select
              value={rewardPolicy}
              onChange={(e) => setRewardPolicy(e.target.value as 'SENDER_ONLY' | 'BOTH')}
              className={inputClass}
            >
              {REWARD_POLICIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>자동 보상 재화</label>
            <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700">
              {category === 'PEOPLE' ? 'People -> V.Medal 자동 지급' : 'Culture -> V.Credit 자동 지급'}
            </div>
            <label className={`${labelClass} mt-3`}>보상 수량 *</label>
            <input
              type="number"
              min={0}
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              className={inputClass}
              placeholder={category === 'PEOPLE' ? 'M 수량' : 'C 수량'}
            />
          </div>
        </div>
      </section>

      {/* 인증 방식 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-gray-900">인증 방식 *</h2>
        <p className="mb-4 text-sm text-gray-600">
          항목 추가 후 직원에게 보여줄 안내 문구를 입력하세요. 각 항목 왼쪽 아이콘을 드래그하여 순서를 변경할 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {VERIFICATION_METHOD_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => addVerificationItem(value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-100"
            >
              {label}
            </button>
          ))}
        </div>
        {verificationItems.length > 0 && (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={verificationItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="mt-4 space-y-3">
                {verificationItems.map((item, index) => (
                  <SortableVerificationItem
                    key={item.id}
                    item={item}
                    index={index}
                    onRemove={removeVerificationItem}
                    onInstructionChange={setVerificationInstruction}
                    onInputStyleChange={setVerificationInputStyle}
                    onLabelChange={setVerificationLabel}
                    onUnitChange={setVerificationUnit}
                    onOptionsChange={setVerificationOptions}
                    inputClass={inputClass}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 btn-press"
        >
          {pending ? '등록 중…' : '이벤트 등록'}
        </button>
        <Link
          href="/admin/events"
          className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:border-gray-300 btn-press-link"
        >
          취소
        </Link>
      </div>
    </form>
  )
}
