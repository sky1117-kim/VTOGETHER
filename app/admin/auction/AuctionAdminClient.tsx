'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  createAuctionEvent,
  createAuctionItem,
  deleteAuctionEvent,
  deleteAuctionItem,
  updateAuctionEvent,
  updateAuctionItem,
  uploadAuctionItemImage,
  type AuctionEventRow,
  type AuctionItemRow,
} from '@/api/actions/admin/auction'
import { formatIntegerWithCommas, sanitizeIntegerInput } from '@/lib/number-format'

type AuctionCategory = 'LAPTOP' | 'MONITOR' | 'ETC'

const categoryLabel: Record<AuctionCategory, string> = {
  LAPTOP: '노트북',
  MONITOR: '모니터',
  ETC: '기타',
}

function buildSpecSummary(item: AuctionItemRow): string | null {
  const parts: string[] = []
  if (item.size) parts.push(`사이즈 ${item.size}`)
  if (item.manufacture_date) parts.push(`제조 ${item.manufacture_date}`)
  if (item.serial_number) parts.push(`S/N ${item.serial_number}`)
  if (item.category === 'MONITOR' && item.has_adapter != null) parts.push(`어답터 ${item.has_adapter ? '포함' : '미포함'}`)
  if (item.spec_detail) parts.push(item.spec_detail)
  if (item.functional_notes) parts.push(`특이사항: ${item.functional_notes}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 900 * 1024) return file
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('이미지 읽기에 실패했습니다.'))
    reader.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('이미지 로딩에 실패했습니다.'))
    el.src = dataUrl
  })
  const maxWidth = 1600
  const ratio = img.width > maxWidth ? maxWidth / img.width : 1
  const targetWidth = Math.max(1, Math.round(img.width * ratio))
  const targetHeight = Math.max(1, Math.round(img.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/webp', 0.82))
  if (!blob) return file
  const compressed = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' })
  return compressed.size < file.size ? compressed : file
}

export function AuctionAdminClient({
  events,
  items,
  selectedEventId,
}: {
  events: AuctionEventRow[]
  items: AuctionItemRow[]
  selectedEventId: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const selectedEvent = events.find((e) => e.event_id === selectedEventId) ?? null

  const [showEventForm, setShowEventForm] = useState(events.length === 0)
  const [eventForm, setEventForm] = useState({ title: '', description: '', start_at: '', end_at: '' })

  const [editingEvent, setEditingEvent] = useState(false)
  const [eventEditForm, setEventEditForm] = useState({
    title: selectedEvent?.title ?? '',
    description: selectedEvent?.description ?? '',
    start_at: selectedEvent ? toDatetimeLocalValue(selectedEvent.start_at) : '',
    end_at: selectedEvent ? toDatetimeLocalValue(selectedEvent.end_at) : '',
    is_active: selectedEvent?.is_active ?? true,
  })

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState({
    name: '',
    model_name: '',
    category: 'LAPTOP' as AuctionCategory,
    description: '',
    size: '',
    manufacture_date: '',
    serial_number: '',
    has_adapter: false,
    spec_detail: '',
    functional_notes: '',
    starting_price: 50000,
    min_bid_increment: 5000,
    image_url: '',
    image_url_2: '',
    display_order: 0,
  })
  const [editItemForm, setEditItemForm] = useState({
    name: '',
    model_name: '',
    category: 'LAPTOP' as AuctionCategory,
    description: '',
    size: '',
    manufacture_date: '',
    serial_number: '',
    has_adapter: false,
    spec_detail: '',
    functional_notes: '',
    starting_price: 50000,
    min_bid_increment: 5000,
    image_url: '',
    image_url_2: '',
    display_order: 0,
    is_active: true,
  })

  function selectEvent(eventId: string) {
    router.push(`/admin/auction?event=${eventId}`)
  }

  async function handleUpload(files: File[], target: 'create-1' | 'create-2' | 'edit-1' | 'edit-2') {
    if (files.length === 0) return
    startTransition(async () => {
      const file = files[0]
      const optimized = await compressImageFile(file)
      const fd = new FormData()
      fd.append('file', optimized)
      const result = await uploadAuctionItemImage(fd)
      if (!result.url) {
        setMessage(result.error ?? '이미지 업로드 실패')
        return
      }
      if (target === 'create-1') setItemForm((p) => ({ ...p, image_url: result.url! }))
      else if (target === 'create-2') setItemForm((p) => ({ ...p, image_url_2: result.url! }))
      else if (target === 'edit-1') setEditItemForm((p) => ({ ...p, image_url: result.url! }))
      else setEditItemForm((p) => ({ ...p, image_url_2: result.url! }))
      setMessage('이미지를 업로드했습니다.')
    })
  }

  function handleDeleteItem(item: AuctionItemRow) {
    if (!window.confirm(`'${item.name}' 품목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await deleteAuctionItem(item.item_id)
      if (!result.success) return setMessage(result.error ?? '삭제 실패')
      if (editingItemId === item.item_id) setEditingItemId(null)
      setMessage('품목을 삭제했습니다.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</div>}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900">경매 이벤트</h3>
          <button
            type="button"
            onClick={() => setShowEventForm((v) => !v)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {showEventForm ? '취소' : '새 이벤트 만들기'}
          </button>
        </div>

        {events.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {events.map((e) => (
              <button
                key={e.event_id}
                type="button"
                onClick={() => selectEvent(e.event_id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                  e.event_id === selectedEventId
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {e.title} {!e.is_active && '(비활성)'}
              </button>
            ))}
          </div>
        )}

        {showEventForm && (
          <div className="mt-4 grid gap-3 rounded-xl border border-gray-200 bg-gray-50/40 p-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
              placeholder="이벤트명 (예: RE:Boot 노트북/모니터 경매)"
              value={eventForm.title}
              onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
            />
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
              placeholder="설명 (선택)"
              value={eventForm.description}
              onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))}
            />
            <label className="text-xs font-semibold text-gray-600">
              시작 일시
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={eventForm.start_at}
                onChange={(e) => setEventForm((p) => ({ ...p, start_at: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              종료 일시
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={eventForm.end_at}
                onChange={(e) => setEventForm((p) => ({ ...p, end_at: e.target.value }))}
              />
            </label>
            <button
              type="button"
              disabled={isPending || !eventForm.title.trim() || !eventForm.start_at || !eventForm.end_at}
              onClick={() => {
                startTransition(async () => {
                  const result = await createAuctionEvent({
                    title: eventForm.title,
                    description: eventForm.description,
                    start_at: new Date(eventForm.start_at).toISOString(),
                    end_at: new Date(eventForm.end_at).toISOString(),
                  })
                  if (!result.success) return setMessage(result.error ?? '이벤트 등록 실패')
                  setMessage('이벤트를 등록했습니다.')
                  setEventForm({ title: '', description: '', start_at: '', end_at: '' })
                  setShowEventForm(false)
                  if (result.event_id) router.push(`/admin/auction?event=${result.event_id}`)
                  else router.refresh()
                })
              }}
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 md:col-span-2"
            >
              {isPending ? '저장 중...' : '이벤트 등록'}
            </button>
          </div>
        )}

        {selectedEvent && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-green-900">{selectedEvent.title}</p>
              <button
                type="button"
                onClick={() => {
                  setEditingEvent((v) => !v)
                  setEventEditForm({
                    title: selectedEvent.title,
                    description: selectedEvent.description ?? '',
                    start_at: toDatetimeLocalValue(selectedEvent.start_at),
                    end_at: toDatetimeLocalValue(selectedEvent.end_at),
                    is_active: selectedEvent.is_active,
                  })
                }}
                className="rounded-lg border border-green-300 bg-white px-2.5 py-1 text-xs font-semibold text-green-800 hover:bg-green-100"
              >
                {editingEvent ? '닫기' : '수정'}
              </button>
            </div>
            <p className="mt-1 text-xs text-green-800">
              {new Date(selectedEvent.start_at).toLocaleString('ko-KR')} ~ {new Date(selectedEvent.end_at).toLocaleString('ko-KR')}
            </p>

            {editingEvent && (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm md:col-span-2"
                  value={eventEditForm.title}
                  onChange={(e) => setEventEditForm((p) => ({ ...p, title: e.target.value }))}
                />
                <input
                  className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm md:col-span-2"
                  value={eventEditForm.description}
                  onChange={(e) => setEventEditForm((p) => ({ ...p, description: e.target.value }))}
                />
                <input
                  type="datetime-local"
                  className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                  value={eventEditForm.start_at}
                  onChange={(e) => setEventEditForm((p) => ({ ...p, start_at: e.target.value }))}
                />
                <input
                  type="datetime-local"
                  className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                  value={eventEditForm.end_at}
                  onChange={(e) => setEventEditForm((p) => ({ ...p, end_at: e.target.value }))}
                />
                <label className="flex items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={eventEditForm.is_active}
                    onChange={(e) => setEventEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  노출 활성화
                </label>
                <div className="flex items-center gap-2 md:col-span-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await updateAuctionEvent({
                          event_id: selectedEvent.event_id,
                          title: eventEditForm.title,
                          description: eventEditForm.description,
                          start_at: new Date(eventEditForm.start_at).toISOString(),
                          end_at: new Date(eventEditForm.end_at).toISOString(),
                          is_active: eventEditForm.is_active,
                        })
                        if (!result.success) return setMessage(result.error ?? '수정 실패')
                        setMessage('이벤트 정보를 수정했습니다.')
                        setEditingEvent(false)
                        router.refresh()
                      })
                    }}
                    className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!window.confirm('이 이벤트를 삭제하시겠습니까? 등록된 품목도 함께 숨겨집니다.')) return
                      startTransition(async () => {
                        const result = await deleteAuctionEvent(selectedEvent.event_id)
                        if (!result.success) return setMessage(result.error ?? '삭제 실패')
                        setMessage('이벤트를 삭제했습니다.')
                        router.push('/admin/auction')
                      })
                    }}
                    className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    이벤트 삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {selectedEvent && (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">품목 등록</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="품목명 (예: MacBook Pro 14 2021)"
                value={itemForm.name}
                onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="모델명 (선택)"
                value={itemForm.model_name}
                onChange={(e) => setItemForm((p) => ({ ...p, model_name: e.target.value }))}
              />
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={itemForm.category}
                onChange={(e) => setItemForm((p) => ({ ...p, category: e.target.value as AuctionCategory }))}
              >
                <option value="LAPTOP">노트북</option>
                <option value="MONITOR">모니터</option>
              </select>
              <input
                type="text"
                inputMode="numeric"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="노출 순서 (작을수록 먼저)"
                value={itemForm.display_order}
                onChange={(e) => setItemForm((p) => ({ ...p, display_order: Number(sanitizeIntegerInput(e.target.value) || '0') }))}
              />
              <input
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
                placeholder="설명 (선택)"
                value={itemForm.description}
                onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
              />

              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-3 md:col-span-2">
                <p className="mb-2 text-xs font-bold text-gray-500">상세 스펙 ({categoryLabel[itemForm.category]} 항목)</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {itemForm.category === 'MONITOR' && (
                    <input
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="사이즈 (예: 27인치)"
                      value={itemForm.size}
                      onChange={(e) => setItemForm((p) => ({ ...p, size: e.target.value }))}
                    />
                  )}
                  <input
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="연식/제조년월 (예: 2022년 3월)"
                    value={itemForm.manufacture_date}
                    onChange={(e) => setItemForm((p) => ({ ...p, manufacture_date: e.target.value }))}
                  />
                  <input
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="시리얼번호"
                    value={itemForm.serial_number}
                    onChange={(e) => setItemForm((p) => ({ ...p, serial_number: e.target.value }))}
                  />
                  {itemForm.category === 'MONITOR' && (
                    <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={itemForm.has_adapter}
                        onChange={(e) => setItemForm((p) => ({ ...p, has_adapter: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      어답터 포함
                    </label>
                  )}
                  {itemForm.category === 'LAPTOP' && (
                    <input
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm md:col-span-2"
                      placeholder="사양 (예: i7-1165G7 / RAM 16GB / SSD 512GB)"
                      value={itemForm.spec_detail}
                      onChange={(e) => setItemForm((p) => ({ ...p, spec_detail: e.target.value }))}
                    />
                  )}
                  <input
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm md:col-span-2"
                    placeholder="기능 특이사항 (예: 배터리 교체 필요, 키보드 일부 눌림 등)"
                    value={itemForm.functional_notes}
                    onChange={(e) => setItemForm((p) => ({ ...p, functional_notes: e.target.value }))}
                  />
                </div>
              </div>

              <input
                type="text"
                inputMode="numeric"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="시작가(원)"
                value={formatIntegerWithCommas(itemForm.starting_price)}
                onChange={(e) => setItemForm((p) => ({ ...p, starting_price: Number(sanitizeIntegerInput(e.target.value) || '0') }))}
              />
              <input
                type="text"
                inputMode="numeric"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="입찰 단위(원)"
                value={formatIntegerWithCommas(itemForm.min_bid_increment)}
                onChange={(e) => setItemForm((p) => ({ ...p, min_bid_increment: Number(sanitizeIntegerInput(e.target.value) || '0') }))}
              />
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-600">품목 이미지 1 (대표, 노트북은 닫힌 상태)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={isPending}
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                  onChange={(e) => void handleUpload(Array.from(e.target.files ?? []), 'create-1')}
                />
                {itemForm.image_url && (
                  <div className="relative h-24 w-40 overflow-hidden rounded-xl border border-gray-200">
                    <Image src={itemForm.image_url} alt="미리보기" fill sizes="200px" unoptimized className="object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-600">품목 이미지 2 (선택, 노트북은 펼친 상태)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={isPending}
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                  onChange={(e) => void handleUpload(Array.from(e.target.files ?? []), 'create-2')}
                />
                {itemForm.image_url_2 && (
                  <div className="relative h-24 w-40 overflow-hidden rounded-xl border border-gray-200">
                    <Image src={itemForm.image_url_2} alt="미리보기" fill sizes="200px" unoptimized className="object-cover" />
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={isPending || !itemForm.name.trim() || itemForm.starting_price <= 0}
              onClick={() => {
                startTransition(async () => {
                  const result = await createAuctionItem({
                    event_id: selectedEvent.event_id,
                    name: itemForm.name,
                    model_name: itemForm.model_name,
                    category: itemForm.category,
                    description: itemForm.description,
                    size: itemForm.size,
                    manufacture_date: itemForm.manufacture_date,
                    serial_number: itemForm.serial_number,
                    has_adapter: itemForm.has_adapter,
                    spec_detail: itemForm.spec_detail,
                    functional_notes: itemForm.functional_notes,
                    starting_price: itemForm.starting_price,
                    min_bid_increment: itemForm.min_bid_increment,
                    image_url: itemForm.image_url || null,
                    image_url_2: itemForm.image_url_2 || null,
                    display_order: itemForm.display_order,
                  })
                  if (!result.success) return setMessage(result.error ?? '등록 실패')
                  setMessage('품목이 등록되었습니다.')
                  setItemForm({
                    name: '',
                    model_name: '',
                    category: 'LAPTOP',
                    description: '',
                    size: '',
                    manufacture_date: '',
                    serial_number: '',
                    has_adapter: false,
                    spec_detail: '',
                    functional_notes: '',
                    starting_price: 50000,
                    min_bid_increment: 5000,
                    image_url: '',
                    image_url_2: '',
                    display_order: 0,
                  })
                  router.refresh()
                })
              }}
              className="mt-4 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? '저장 중...' : '품목 등록'}
            </button>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">등록 품목 목록</h3>
              <p className="text-xs text-gray-500">총 {items.length}건</p>
            </div>
            {items.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                등록된 품목이 없습니다.
              </div>
            )}
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.item_id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {item.image_url && (
                        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200">
                          <Image src={item.image_url} alt={item.name} fill sizes="96px" unoptimized className="object-cover" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {item.name} <span className="text-xs font-normal text-gray-500">({categoryLabel[item.category]})</span>
                        </h4>
                        {item.model_name && <p className="mt-0.5 text-xs text-gray-500">{item.model_name}</p>}
                        {buildSpecSummary(item) && (
                          <p className="mt-0.5 truncate text-xs text-gray-500">{buildSpecSummary(item)}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-600">
                          시작가 {item.starting_price.toLocaleString()}원 · 단위 {item.min_bid_increment.toLocaleString()}원
                        </p>
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          {item.current_highest_bid != null
                            ? `현재 최고가 ${item.current_highest_bid.toLocaleString()}원 (${item.current_highest_bidder_name ?? '알 수 없음'})`
                            : '입찰 없음'}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await updateAuctionItem({
                              item_id: item.item_id,
                              name: item.name,
                              model_name: item.model_name,
                              category: item.category,
                              description: item.description,
                              size: item.size,
                              manufacture_date: item.manufacture_date,
                              serial_number: item.serial_number,
                              has_adapter: item.has_adapter,
                              spec_detail: item.spec_detail,
                              functional_notes: item.functional_notes,
                              starting_price: item.starting_price,
                              min_bid_increment: item.min_bid_increment,
                              image_url: item.image_url,
                              image_url_2: item.image_url_2,
                              display_order: item.display_order,
                              is_active: !item.is_active,
                            })
                            if (!result.success) return setMessage(result.error ?? '상태 변경 실패')
                            setMessage(item.is_active ? '품목을 숨겼습니다.' : '품목을 다시 노출했습니다.')
                            router.refresh()
                          })
                        }}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${item.is_active ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                      >
                        {item.is_active ? '숨김' : '노출'}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setEditingItemId(item.item_id)
                          setEditItemForm({
                            name: item.name,
                            model_name: item.model_name ?? '',
                            category: item.category,
                            description: item.description ?? '',
                            size: item.size ?? '',
                            manufacture_date: item.manufacture_date ?? '',
                            serial_number: item.serial_number ?? '',
                            has_adapter: item.has_adapter ?? false,
                            spec_detail: item.spec_detail ?? '',
                            functional_notes: item.functional_notes ?? '',
                            starting_price: item.starting_price,
                            min_bid_increment: item.min_bid_increment,
                            image_url: item.image_url ?? '',
                            image_url_2: item.image_url_2 ?? '',
                            display_order: item.display_order,
                            is_active: item.is_active,
                          })
                        }}
                        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteItem(item)}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {editingItemId === item.item_id && (
                    <div className="mt-3 grid gap-2 rounded-xl border border-green-200 bg-green-50/60 p-3 md:grid-cols-2">
                      <input
                        className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                        value={editItemForm.name}
                        onChange={(e) => setEditItemForm((p) => ({ ...p, name: e.target.value }))}
                      />
                      <input
                        className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                        placeholder="모델명"
                        value={editItemForm.model_name}
                        onChange={(e) => setEditItemForm((p) => ({ ...p, model_name: e.target.value }))}
                      />
                      <select
                        className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                        value={editItemForm.category}
                        onChange={(e) => setEditItemForm((p) => ({ ...p, category: e.target.value as AuctionCategory }))}
                      >
                        <option value="LAPTOP">노트북</option>
                        <option value="MONITOR">모니터</option>
                      </select>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                        placeholder="노출 순서"
                        value={editItemForm.display_order}
                        onChange={(e) => setEditItemForm((p) => ({ ...p, display_order: Number(sanitizeIntegerInput(e.target.value) || '0') }))}
                      />
                      <input
                        className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm md:col-span-2"
                        placeholder="설명"
                        value={editItemForm.description}
                        onChange={(e) => setEditItemForm((p) => ({ ...p, description: e.target.value }))}
                      />

                      <div className="rounded-xl border border-dashed border-green-200 bg-white/60 p-3 md:col-span-2">
                        <p className="mb-2 text-xs font-bold text-green-700">
                          상세 스펙 ({categoryLabel[editItemForm.category]} 항목)
                        </p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {editItemForm.category === 'MONITOR' && (
                            <input
                              className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                              placeholder="사이즈 (예: 27인치)"
                              value={editItemForm.size}
                              onChange={(e) => setEditItemForm((p) => ({ ...p, size: e.target.value }))}
                            />
                          )}
                          <input
                            className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                            placeholder="연식/제조년월 (예: 2022년 3월)"
                            value={editItemForm.manufacture_date}
                            onChange={(e) => setEditItemForm((p) => ({ ...p, manufacture_date: e.target.value }))}
                          />
                          <input
                            className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                            placeholder="시리얼번호"
                            value={editItemForm.serial_number}
                            onChange={(e) => setEditItemForm((p) => ({ ...p, serial_number: e.target.value }))}
                          />
                          {editItemForm.category === 'MONITOR' && (
                            <label className="flex items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={editItemForm.has_adapter}
                                onChange={(e) => setEditItemForm((p) => ({ ...p, has_adapter: e.target.checked }))}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              어답터 포함
                            </label>
                          )}
                          {editItemForm.category === 'LAPTOP' && (
                            <input
                              className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm md:col-span-2"
                              placeholder="사양 (예: i7-1165G7 / RAM 16GB / SSD 512GB)"
                              value={editItemForm.spec_detail}
                              onChange={(e) => setEditItemForm((p) => ({ ...p, spec_detail: e.target.value }))}
                            />
                          )}
                          <input
                            className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm md:col-span-2"
                            placeholder="기능 특이사항"
                            value={editItemForm.functional_notes}
                            onChange={(e) => setEditItemForm((p) => ({ ...p, functional_notes: e.target.value }))}
                          />
                        </div>
                      </div>

                      <input
                        type="text"
                        inputMode="numeric"
                        className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                        placeholder="시작가(원)"
                        value={formatIntegerWithCommas(editItemForm.starting_price)}
                        onChange={(e) => setEditItemForm((p) => ({ ...p, starting_price: Number(sanitizeIntegerInput(e.target.value) || '0') }))}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                        placeholder="입찰 단위(원)"
                        value={formatIntegerWithCommas(editItemForm.min_bid_increment)}
                        onChange={(e) => setEditItemForm((p) => ({ ...p, min_bid_increment: Number(sanitizeIntegerInput(e.target.value) || '0') }))}
                      />
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-green-700">이미지 1 (대표)</label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={isPending}
                          className="block w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-green-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-green-800 hover:file:bg-green-200"
                          onChange={(e) => void handleUpload(Array.from(e.target.files ?? []), 'edit-1')}
                        />
                        {editItemForm.image_url && (
                          <div className="relative h-24 w-40 overflow-hidden rounded-xl border border-gray-200">
                            <Image src={editItemForm.image_url} alt="미리보기" fill sizes="200px" unoptimized className="object-cover" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-green-700">이미지 2 (선택)</label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={isPending}
                          className="block w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-green-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-green-800 hover:file:bg-green-200"
                          onChange={(e) => void handleUpload(Array.from(e.target.files ?? []), 'edit-2')}
                        />
                        {editItemForm.image_url_2 && (
                          <div className="relative h-24 w-40 overflow-hidden rounded-xl border border-gray-200">
                            <Image src={editItemForm.image_url_2} alt="미리보기" fill sizes="200px" unoptimized className="object-cover" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 md:col-span-2">
                        <button
                          type="button"
                          disabled={isPending || !editItemForm.name.trim()}
                          onClick={() => {
                            startTransition(async () => {
                              const result = await updateAuctionItem({
                                item_id: item.item_id,
                                name: editItemForm.name,
                                model_name: editItemForm.model_name,
                                category: editItemForm.category,
                                description: editItemForm.description,
                                size: editItemForm.size,
                                manufacture_date: editItemForm.manufacture_date,
                                serial_number: editItemForm.serial_number,
                                has_adapter: editItemForm.has_adapter,
                                spec_detail: editItemForm.spec_detail,
                                functional_notes: editItemForm.functional_notes,
                                starting_price: editItemForm.starting_price,
                                min_bid_increment: editItemForm.min_bid_increment,
                                image_url: editItemForm.image_url || null,
                                image_url_2: editItemForm.image_url_2 || null,
                                display_order: editItemForm.display_order,
                                is_active: editItemForm.is_active,
                              })
                              if (!result.success) return setMessage(result.error ?? '수정 실패')
                              setMessage('품목 정보를 수정했습니다.')
                              setEditingItemId(null)
                              router.refresh()
                            })
                          }}
                          className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
