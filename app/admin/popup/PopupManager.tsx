'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Plus, Trash2, Edit2, Megaphone, Calendar } from 'lucide-react'
import { createNotice, updateNotice, deleteNotice, toggleNoticePopup } from '@/api/actions/notices'
import { uploadPopupImage } from '@/api/actions/admin'

type PopupItem = {
  id: string
  title: string
  body: string | null
  image_url: string | null
  is_published: boolean
  show_as_popup: boolean
  popup_start_at: string | null
  popup_end_at: string | null
  created_at: string
}

const EMPTY_FORM = {
  title: '',
  body: '',
  image_url: '',
  is_published: true,
  show_as_popup: true,
  popup_start_at: '',
  popup_end_at: '',
}

function toDateValue(iso: string | null) {
  if (!iso) return ''
  return iso.slice(0, 10) // 'YYYY-MM-DD'
}

function toStartIso(date: string) {
  if (!date) return null
  return new Date(`${date}T00:00:00`).toISOString()
}

function toEndIso(date: string) {
  if (!date) return null
  return new Date(`${date}T23:59:59`).toISOString()
}

function formatPeriod(item: PopupItem) {
  if (!item.popup_start_at && !item.popup_end_at) return '기간 제한 없음'
  const fmt = (s: string) => new Date(s).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  if (item.popup_start_at && item.popup_end_at) return `${fmt(item.popup_start_at)} ~ ${fmt(item.popup_end_at)}`
  if (item.popup_start_at) return `${fmt(item.popup_start_at)}부터`
  return `${fmt(item.popup_end_at!)}까지`
}

function isActive(item: PopupItem) {
  if (!item.is_published || !item.show_as_popup) return false
  const now = Date.now()
  if (item.popup_start_at && new Date(item.popup_start_at).getTime() > now) return false
  if (item.popup_end_at && new Date(item.popup_end_at).getTime() < now) return false
  return true
}

export function PopupManager({ popups: initial }: { popups: PopupItem[] }) {
  const [popups, setPopups] = useState(initial)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [pending, setPending] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function openNew() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
    setMessage(null)
  }

  function openEdit(p: PopupItem) {
    setForm({
      title: p.title,
      body: p.body ?? '',
      image_url: p.image_url ?? '',
      is_published: p.is_published,
      show_as_popup: p.show_as_popup,
      popup_start_at: toDateValue(p.popup_start_at),
      popup_end_at: toDateValue(p.popup_end_at),
    })
    setEditingId(p.id)
    setShowForm(true)
    setMessage(null)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadPopupImage(fd)
    setImageUploading(false)
    if (res.url) setForm((p) => ({ ...p, image_url: res.url! }))
    else setMessage({ type: 'error', text: res.error ?? '업로드 실패' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setPending(true)
    setMessage(null)

    const payload = {
      title: form.title,
      body: form.body,
      image_url: form.image_url,
      is_published: form.is_published,
      show_as_popup: form.show_as_popup,
      popup_start_at: toStartIso(form.popup_start_at) as unknown as string,
      popup_end_at: toEndIso(form.popup_end_at) as unknown as string,
    }

    if (editingId) {
      const res = await updateNotice(editingId, payload)
      if (res.error) { setMessage({ type: 'error', text: res.error }); setPending(false); return }
      setPopups((prev) => prev.map((p) => p.id === editingId
        ? { ...p, ...form, body: form.body || null, image_url: form.image_url || null, popup_start_at: toStartIso(form.popup_start_at), popup_end_at: toEndIso(form.popup_end_at) }
        : p
      ))
    } else {
      const res = await createNotice(payload)
      if (res.error || !res.id) { setMessage({ type: 'error', text: res.error ?? '생성 실패' }); setPending(false); return }
      setPopups((prev) => [{
        id: res.id!,
        ...form,
        body: form.body || null,
        image_url: form.image_url || null,
        popup_start_at: toStartIso(form.popup_start_at),
        popup_end_at: toEndIso(form.popup_end_at),
        created_at: new Date().toISOString(),
      }, ...prev])
    }
    setPending(false)
    setShowForm(false)
    setMessage({ type: 'ok', text: editingId ? '수정되었습니다.' : '팝업이 등록되었습니다.' })
  }

  async function handleDelete(id: string) {
    if (!confirm('팝업을 삭제하시겠습니까?')) return
    const res = await deleteNotice(id)
    if (!res.error) setPopups((prev) => prev.filter((p) => p.id !== id))
  }

  async function handleToggleActive(p: PopupItem) {
    const next = !p.show_as_popup
    await toggleNoticePopup(p.id, next)
    setPopups((prev) => prev.map((item) => item.id === p.id ? { ...item, show_as_popup: next } : item))
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700">
        <Plus className="size-4" /> 새 팝업 등록
      </button>

      {/* 등록/수정 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-gray-900">{editingId ? '팝업 수정' : '새 팝업'}</h2>

          {/* 이미지 */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">이미지</p>
            {form.image_url && (
              <div className="relative mb-2 overflow-hidden rounded-xl bg-gray-950" style={{ maxHeight: '280px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="미리보기" className="h-auto w-full object-contain" style={{ display: 'block', maxHeight: '280px' }} />
                {imageUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">업로드 중...</div>}
                <button type="button" onClick={() => setForm((p) => ({ ...p, image_url: '' }))} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">✕</button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} disabled={imageUploading} className="block w-full cursor-pointer rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-green-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-green-700 hover:border-green-400 disabled:opacity-50" />
          </div>

          {/* 제목 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">제목 <span className="text-xs font-normal text-gray-400">(한글 10자 이내 권장)</span></label>
            <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="예: 🎉 수상 소식" required className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400" />
          </div>

          {/* 내용 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">내용</label>
            <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} rows={3} placeholder="소개 문구를 입력하세요." className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400" />
          </div>

          {/* 게시 기간 */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Calendar className="size-4 text-gray-400" /> 게시 기간
              <span className="text-xs font-normal text-gray-400">(비워두면 상시 표시)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">시작일</label>
                <input
                  type="date"
                  value={form.popup_start_at}
                  onChange={(e) => setForm((p) => ({ ...p, popup_start_at: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">종료일</label>
                <input
                  type="date"
                  value={form.popup_end_at}
                  onChange={(e) => setForm((p) => ({ ...p, popup_end_at: e.target.value }))}
                  min={form.popup_start_at || undefined}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>
            </div>
            {form.popup_start_at && form.popup_end_at && (
              <p className="mt-1.5 text-xs text-gray-400">
                {form.popup_start_at} 00:00 ~ {form.popup_end_at} 23:59에 표시됩니다.
              </p>
            )}
          </div>

          {/* 옵션 */}
          <div className="flex gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))} className="rounded" />
              즉시 공개
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.show_as_popup} onChange={(e) => setForm((p) => ({ ...p, show_as_popup: e.target.checked }))} className="rounded" />
              팝업 활성화
            </label>
          </div>

          {/* 저장 */}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={pending || imageUploading} className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
              {pending ? '저장 중...' : '저장'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">취소</button>
          </div>
        </form>
      )}

      {/* 팝업 목록 */}
      <div className="space-y-3">
        {popups.length === 0 && <p className="py-6 text-center text-sm text-gray-400">등록된 팝업이 없습니다.</p>}
        {popups.map((p) => {
          const active = isActive(p)
          return (
            <div key={p.id} className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${active ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'}`}>
              {p.image_url && (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-950">
                  <Image src={p.image_url} alt={p.title} fill className="object-contain" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold text-gray-900">{p.title}</p>
                  {active
                    ? <span className="shrink-0 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">표시 중</span>
                    : <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">비활성</span>
                  }
                </div>
                <p className="mt-0.5 text-xs text-gray-400 flex items-center gap-1">
                  <Calendar className="size-3" /> {formatPeriod(p)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => handleToggleActive(p)} title={p.show_as_popup ? '팝업 비활성화' : '팝업 활성화'} className={`rounded-lg p-1.5 transition ${p.show_as_popup ? 'text-green-500 hover:text-green-700' : 'text-gray-300 hover:text-green-500'}`}>
                  <Megaphone className="size-4" />
                </button>
                <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-gray-400 hover:text-blue-600 transition">
                  <Edit2 className="size-4" />
                </button>
                <button onClick={() => handleDelete(p.id)} className="rounded-lg p-1.5 text-gray-400 hover:text-rose-500 transition">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
