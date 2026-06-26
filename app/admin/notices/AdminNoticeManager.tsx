'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Plus, Trash2, Edit2, Eye, EyeOff, Megaphone } from 'lucide-react'
import { createNotice, updateNotice, deleteNotice, toggleNoticePopup } from '@/api/actions/notices'
import { uploadPopupImage } from '@/api/actions/admin'

type NoticeItem = {
  id: string
  title: string
  body: string | null
  image_url: string | null
  is_published: boolean
  show_as_popup: boolean
  created_at: string
}

const EMPTY_FORM = { title: '', body: '', image_url: '', is_published: true, show_as_popup: false }

export function AdminNoticeManager({ notices: initial }: { notices: NoticeItem[] }) {
  const [notices, setNotices] = useState(initial)
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

  function openEdit(n: NoticeItem) {
    setForm({ title: n.title, body: n.body ?? '', image_url: n.image_url ?? '', is_published: n.is_published, show_as_popup: n.show_as_popup })
    setEditingId(n.id)
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
    if (editingId) {
      const res = await updateNotice(editingId, form)
      if (res.error) { setMessage({ type: 'error', text: res.error }); setPending(false); return }
      setNotices((prev) => prev.map((n) => n.id === editingId ? { ...n, ...form, body: form.body || null, image_url: form.image_url || null } : n))
    } else {
      const res = await createNotice(form)
      if (res.error || !res.id) { setMessage({ type: 'error', text: res.error ?? '생성 실패' }); setPending(false); return }
      setNotices((prev) => [{ id: res.id!, ...form, body: form.body || null, image_url: form.image_url || null, created_at: new Date().toISOString() }, ...prev])
    }
    setPending(false)
    setShowForm(false)
    setMessage({ type: 'ok', text: editingId ? '수정되었습니다.' : '소식이 등록되었습니다.' })
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await deleteNotice(id)
    if (!res.error) setNotices((prev) => prev.filter((n) => n.id !== id))
  }

  async function handleTogglePublish(n: NoticeItem) {
    const next = !n.is_published
    await updateNotice(n.id, { title: n.title, body: n.body ?? '', image_url: n.image_url ?? '', is_published: next, show_as_popup: n.show_as_popup })
    setNotices((prev) => prev.map((item) => item.id === n.id ? { ...item, is_published: next } : item))
  }

  async function handleTogglePopup(n: NoticeItem) {
    const next = !n.show_as_popup
    await toggleNoticePopup(n.id, next)
    setNotices((prev) => prev.map((item) => item.id === n.id ? { ...item, show_as_popup: next } : item))
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700">
        <Plus className="size-4" /> 새 소식 등록
      </button>

      {showForm && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-700">{editingId ? '소식 수정' : '새 소식'}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="text" placeholder="제목 *" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            <textarea placeholder="내용 (선택)" value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none" />
            {form.image_url && (
              <div className="relative overflow-hidden rounded-lg bg-gray-950" style={{ maxHeight: '200px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="미리보기" className="h-auto w-full object-contain" style={{ display: 'block', maxHeight: '200px' }} />
                <button type="button" onClick={() => setForm((p) => ({ ...p, image_url: '' }))} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white text-xs">✕</button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} disabled={imageUploading} className="block w-full cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-green-50 file:px-2 file:py-1 file:text-xs file:text-green-700" />
            {imageUploading && <p className="text-xs text-gray-400">이미지 업로드 중...</p>}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))} className="rounded" />
                즉시 공개
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.show_as_popup} onChange={(e) => setForm((p) => ({ ...p, show_as_popup: e.target.checked }))} className="rounded" />
                팝업으로 표시
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pending || imageUploading} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                {editingId ? '수정' : '등록'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">취소</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {notices.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">등록된 소식이 없습니다.</p>}
        {notices.map((n) => (
          <div key={n.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${n.is_published ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
            {n.image_url && (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-950">
                <Image src={n.image_url} alt={n.title} fill className="object-contain" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold text-gray-900">{n.title}</p>
                {n.show_as_popup && (
                  <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">팝업</span>
                )}
              </div>
              <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString('ko-KR')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => handleTogglePopup(n)} title={n.show_as_popup ? '팝업 해제' : '팝업으로 표시'} className={`rounded-lg p-1.5 transition ${n.show_as_popup ? 'text-purple-500 hover:text-purple-700' : 'text-gray-300 hover:text-purple-500'}`}>
                <Megaphone className="size-4" />
              </button>
              <button onClick={() => handleTogglePublish(n)} title={n.is_published ? '비공개' : '공개'} className="rounded-lg p-1.5 text-gray-400 hover:text-green-600 transition">
                {n.is_published ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
              <button onClick={() => openEdit(n)} className="rounded-lg p-1.5 text-gray-400 hover:text-blue-600 transition">
                <Edit2 className="size-4" />
              </button>
              <button onClick={() => handleDelete(n.id)} className="rounded-lg p-1.5 text-gray-400 hover:text-rose-500 transition">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
