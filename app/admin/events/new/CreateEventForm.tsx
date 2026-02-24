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
import type { VerificationMethodInput, EventRewardInput, EventRow } from '@/api/actions/admin/events'
import {
  EVENT_CATEGORIES,
  EVENT_TYPES,
  FREQUENCY_LIMITS,
  REWARD_POLICIES,
  REWARD_KINDS,
  VERIFICATION_METHOD_TYPES,
  VALUE_UNIT_OPTIONS,
  VALUE_UNIT_CUSTOM,
} from '@/constants/events'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500'
const inputNumberClass =
  'mt-1 w-32 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500'
const labelClass = 'block text-sm font-bold text-gray-700'

type VerificationMethodType = VerificationMethodInput['method_type']

/** 인증 항목 1개 (타입 + 직원 안내문 + 단답/장문 또는 단위) */
interface VerificationItem {
  id: string
  method_type: VerificationMethodType
  instruction: string
  /** TEXT용. VALUE는 숫자만 입력되므로 사용 안 함 */
  input_style: 'SHORT' | 'LONG'
  /** VALUE용. 단위 (예: km/h, km). 선택 또는 직접 입력 */
  unit?: string
}

function buildPayload(
  state: {
    title: string
    shortDescription: string
    description: string
    category: 'V_TOGETHER' | 'CULTURE'
    type: 'ALWAYS' | 'SEASONAL'
    frequencyLimit: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
    rewardPolicy: 'SENDER_ONLY' | 'BOTH'
    selectedRewards: { kind: 'V_POINT' | 'GOODS' | 'COFFEE_COUPON'; amount: string }[]
    verificationItems: VerificationItem[]
  },
  createdBy: string
) {
  const rewards: EventRewardInput[] = state.selectedRewards.map((r) => ({
    reward_kind: r.kind,
    amount: r.kind === 'GOODS' ? null : Math.max(0, parseInt(r.amount, 10) || 0),
  }))
  const verification_methods: VerificationMethodInput[] = state.verificationItems.map((item) => ({
    method_type: item.method_type,
    is_required: true,
    instruction: item.instruction.trim() || null,
    input_style: item.method_type === 'PHOTO' ? null : item.method_type === 'VALUE' ? null : item.input_style,
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
  onUnitChange,
  inputClass,
}: {
  item: VerificationItem
  index?: number
  onRemove: (id: string) => void
  onInstructionChange: (id: string, instruction: string) => void
  onInputStyleChange: (id: string, input_style: 'SHORT' | 'LONG') => void
  onUnitChange: (id: string, unit: string) => void
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

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
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
            {VERIFICATION_METHOD_TYPES.find((m) => m.value === item.method_type)?.label ?? item.method_type}
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
      {item.method_type === 'TEXT' && (
        <div>
          <label className="text-xs font-medium text-gray-500">입력 형태</label>
          <select
            value={item.input_style}
            onChange={(e) => onInputStyleChange(item.id, e.target.value as 'SHORT' | 'LONG')}
            className="mt-1 w-28 rounded border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="SHORT">단답</option>
            <option value="LONG">장문</option>
          </select>
        </div>
      )}
      {item.method_type === 'VALUE' && (
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
              className="w-28 rounded border border-gray-300 px-2 py-1.5 text-xs"
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
                className="w-24 rounded border border-gray-300 px-2 py-1.5 text-xs"
              />
            )}
          </div>
        </div>
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
  selectedRewards: { kind: 'V_POINT' | 'GOODS' | 'COFFEE_COUPON'; amount: string }[]
  verificationItems: VerificationItem[]
}): string | null {
  if (!state.title.trim()) return '제목을 입력하세요.'
  if (state.selectedRewards.length === 0) return '보상을 1개 이상 선택하세요.'
  for (const r of state.selectedRewards) {
    if (r.kind !== 'GOODS' && (!r.amount.trim() || parseInt(r.amount, 10) < 0))
      return 'V.Point·커피쿠폰은 금액(수량)을 입력하세요.'
  }
  if (state.verificationItems.length === 0) return '인증 방식을 1개 이상 추가하세요.'
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
  const [category, setCategory] = useState<'V_TOGETHER' | 'CULTURE'>('V_TOGETHER')
  const [type, setType] = useState<'ALWAYS' | 'SEASONAL'>('ALWAYS')
  const [frequencyLimit, setFrequencyLimit] = useState<'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('ONCE')
  const [rewardPolicy, setRewardPolicy] = useState<'SENDER_ONLY' | 'BOTH'>('SENDER_ONLY')
  const [selectedRewards, setSelectedRewards] = useState<
    { kind: 'V_POINT' | 'GOODS' | 'COFFEE_COUPON'; amount: string }[]
  >([])
  const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([])
  const now = new Date()
  const [roundYear, setRoundYear] = useState(now.getFullYear())
  const [roundMonth, setRoundMonth] = useState(now.getMonth() + 1)

  const toggleReward = (kind: 'V_POINT' | 'GOODS' | 'COFFEE_COUPON') => {
    setSelectedRewards((prev) => {
      const exists = prev.some((r) => r.kind === kind)
      if (exists) return prev.filter((r) => r.kind !== kind)
      const needsAmount = REWARD_KINDS.find((k) => k.value === kind)?.needsAmount ?? false
      return [...prev, { kind, amount: needsAmount ? '100' : '' }]
    })
  }

  const setRewardAmount = (kind: 'V_POINT' | 'GOODS' | 'COFFEE_COUPON', value: string) => {
    setSelectedRewards((prev) =>
      prev.map((r) => (r.kind === kind ? { ...r, amount: value } : r))
    )
  }

  const addVerificationItem = (method_type: VerificationMethodType) => {
    const defaultStyle: 'SHORT' | 'LONG' = method_type === 'VALUE' ? 'SHORT' : 'LONG'
    setVerificationItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        method_type,
        instruction: '',
        input_style: defaultStyle,
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
  const setVerificationInputStyle = (id: string, input_style: 'SHORT' | 'LONG') => {
    setVerificationItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, input_style } : item))
    )
  }
  const setVerificationUnit = (id: string, unit: string) => {
    setVerificationItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unit } : item))
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
      setCategory(ev.category)
      setType(ev.type)
      setFrequencyLimit(ev.frequency_limit ?? 'ONCE')
      setRewardPolicy(ev.reward_policy)
      setSelectedRewards(
        revs.map((r) => ({
          kind: r.reward_kind,
          amount: r.amount != null ? String(r.amount) : '',
        }))
      )
      setVerificationItems(
        vms.map((m) => ({
          id: crypto.randomUUID(),
          method_type: m.method_type,
          instruction: m.instruction ?? '',
          input_style: m.input_style ?? (m.method_type === 'VALUE' ? 'SHORT' : 'LONG'),
          unit: m.method_type === 'VALUE' ? (m.unit ?? '') : undefined,
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
    category,
    type,
    frequencyLimit,
    rewardPolicy,
    selectedRewards,
    verificationItems,
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
    const result = await createEvent(buildPayload(state, createdBy), createdBy)
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`rounded-lg px-4 py-2.5 text-sm ${
            message.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {existingEvents.length > 0 && (
        <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">기존 이벤트에서 복사</h3>
          <p className="mb-3 text-xs text-gray-500">선택한 이벤트의 제목·소개·보상·인증 방식을 불러와 수정 후 새로 등록할 수 있습니다.</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={copyEventId}
              onChange={(e) => setCopyEventId(e.target.value)}
              className="min-w-[200px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
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
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
            >
              {copyLoading ? '불러오는 중…' : '불러오기'}
            </button>
          </div>
        </section>
      )}

      {/* 기본 정보 + 이벤트 설정: 한 카드에 2열 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">기본 정보 · 이벤트 설정</h3>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <p className="mt-1 text-xs text-gray-500">한 줄 요약. 카드와 목록에만 보입니다. (최대 120자)</p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>전체 소개 (상세 보기)</label>
            <p className="mt-0.5 mb-1 text-xs text-gray-500">
              글자 선택 후 ⌘B(굵게)·⌘I(기울임) 또는 툴바 버튼 — 입력창에서 바로 반영됩니다
            </p>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="이벤트 상세 안내 문구. 클릭 시 팝업에 포맷 적용되어 표시됩니다."
              aria-label="전체 소개"
            />
            <p className="mt-1 text-xs text-gray-500">상세 보기 팝업에 표시되는 본문입니다.</p>
          </div>
          <div>
            <label className={labelClass}>카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'V_TOGETHER' | 'CULTURE')}
              className={inputClass}
            >
              {EVENT_CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
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
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-gray-600">구간 자동 생성</span>
              <select
                value={roundYear}
                onChange={(e) => setRoundYear(Number(e.target.value))}
                className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm"
              >
                {[0, 1, 2, 3, 4].map((i) => {
                  const y = now.getFullYear() + i
                  return <option key={y} value={y}>{y}년</option>
                })}
              </select>
              <select
                value={roundMonth}
                onChange={(e) => setRoundMonth(Number(e.target.value))}
                className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm"
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
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">보상</h3>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <span className={labelClass}>보상 유형 *</span>
            <div className="mt-2 flex flex-wrap gap-3">
              {REWARD_KINDS.map(({ value, label, needsAmount }) => (
                <div key={value} className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={selectedRewards.some((r) => r.kind === value)}
                      onChange={() => toggleReward(value)}
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                  {needsAmount && selectedRewards.some((r) => r.kind === value) && (
                    <input
                      type="number"
                      min={0}
                      value={selectedRewards.find((r) => r.kind === value)?.amount ?? ''}
                      onChange={(e) => setRewardAmount(value, e.target.value)}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                      placeholder={value === 'V_POINT' ? 'P' : '매수'}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 인증 방식 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">인증 방식 *</h3>
        <p className="mb-3 text-xs text-gray-500">
          항목 추가 후 직원에게 보여줄 안내 문구를 입력하세요. 각 항목 왼쪽 아이콘을 드래그하여 순서를 변경할 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {VERIFICATION_METHOD_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => addVerificationItem(value)}
              className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
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
                    onUnitChange={setVerificationUnit}
                    inputClass={inputClass}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50 btn-press"
        >
          {pending ? '등록 중…' : '이벤트 등록'}
        </button>
        <Link
          href="/admin/events"
          className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 btn-press-link"
        >
          취소
        </Link>
      </div>
    </form>
  )
}
