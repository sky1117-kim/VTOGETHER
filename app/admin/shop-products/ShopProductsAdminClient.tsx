'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  createShopProduct,
  createShopProductVariant,
  deleteShopProduct,
  deleteShopProductVariant,
  getShopProductVariants,
  toggleShopProductActive,
  updateShopProduct,
  updateShopProductVariant,
  uploadShopProductImage,
  type ShopProductVariantRow,
} from '@/api/actions/admin/shop-products'
import { useRouter } from 'next/navigation'
import { formatIntegerWithCommas, sanitizeIntegerInput } from '@/lib/number-format'

type ProductRow = {
  product_id: string
  name: string
  description: string | null
  product_type: 'GOODS' | 'CREDIT_PACK' | 'ESG'
  price_medal: number
  credit_amount: number | null
  stock: number | null
  image_url: string | null
  is_active: boolean
  has_variants: boolean
}

type VariantDraft = { key: string; color: string; size: string; stock: string }

function VariantDraftEditor({
  drafts,
  onChange,
  tone,
}: {
  drafts: VariantDraft[]
  onChange: (next: VariantDraft[]) => void
  tone: 'create' | 'edit'
}) {
  const borderTone = tone === 'create' ? 'border-gray-200 bg-gray-50/40' : 'border-green-200 bg-white'
  return (
    <div className={`space-y-2 rounded-xl border p-3 md:col-span-2 ${borderTone}`}>
      <p className="text-xs font-semibold text-gray-600">색상/사이즈 옵션별 재고</p>
      {drafts.length === 0 && <p className="text-xs text-gray-400">등록된 옵션이 없습니다. 아래에서 추가하세요.</p>}
      {drafts.map((d, idx) => (
        <div key={d.key} className="flex flex-wrap items-center gap-2">
          <input
            className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            placeholder="색상"
            value={d.color}
            onChange={(e) => {
              const next = [...drafts]
              next[idx] = { ...d, color: e.target.value }
              onChange(next)
            }}
          />
          <input
            className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            placeholder="사이즈"
            value={d.size}
            onChange={(e) => {
              const next = [...drafts]
              next[idx] = { ...d, size: e.target.value }
              onChange(next)
            }}
          />
          <input
            type="text"
            inputMode="numeric"
            className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            placeholder="재고"
            value={formatIntegerWithCommas(d.stock)}
            onChange={(e) => {
              const next = [...drafts]
              next[idx] = { ...d, stock: sanitizeIntegerInput(e.target.value) }
              onChange(next)
            }}
          />
          <button
            type="button"
            onClick={() => onChange(drafts.filter((_, i) => i !== idx))}
            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            삭제
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...drafts, { key: `${Date.now()}-${drafts.length}`, color: '', size: '', stock: '0' }])}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
      >
        옵션 추가
      </button>
    </div>
  )
}

function parseImageUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function joinImageUrls(urls: string[]): string {
  return urls.join('\n')
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

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', 0.82)
  })
  if (!blob) return file
  const compressed = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' })
  return compressed.size < file.size ? compressed : file
}

function ProductImageUploadBox({
  imageUrl,
  borderTone,
  fileTone,
  disabled,
  onSelectFiles,
  onClear,
}: {
  imageUrl: string
  borderTone: string
  fileTone: string
  disabled: boolean
  onSelectFiles: (files: File[]) => void
  onClear: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const imageUrls = parseImageUrls(imageUrl)
  return (
    <div className="space-y-2 md:col-span-2">
      <label className="block text-xs font-semibold text-gray-600">상품 이미지</label>
      <div
        className={`rounded-xl border-2 border-dashed p-3 transition ${isDragging ? 'border-green-400 bg-green-50/60' : borderTone}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          onSelectFiles(Array.from(e.dataTransfer.files ?? []))
        }}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            type="file"
            disabled={disabled}
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            className={`block w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-semibold ${fileTone}`}
            onChange={(e) => onSelectFiles(Array.from(e.target.files ?? []))}
          />
          {imageUrls.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              onClick={onClear}
            >
              이미지 제거
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          여러 장 업로드 가능, 순서대로 노출됩니다. (자동 압축 적용)
        </p>
      </div>
      {imageUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500">업로드된 이미지 {imageUrls.length}장</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {imageUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="relative h-24 overflow-hidden rounded-xl border border-gray-200">
                <Image src={url} alt={`상품 미리보기 ${index + 1}`} fill sizes="200px" unoptimized className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ShopProductsAdminClient({ products }: { products: ProductRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GOODS' | 'CREDIT_PACK' | 'ESG'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [form, setForm] = useState({
    name: '',
    description: '',
    product_type: 'GOODS' as 'GOODS' | 'CREDIT_PACK' | 'ESG',
    price_medal: 10,
    credit_amount: 1000,
    stock: '',
    has_variants: false,
    image_url: '',
  })
  const [createVariantDrafts, setCreateVariantDrafts] = useState<VariantDraft[]>([])
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    product_type: 'GOODS' as 'GOODS' | 'CREDIT_PACK' | 'ESG',
    price_medal: 10,
    credit_amount: 1000,
    stock: '',
    has_variants: false,
    image_url: '',
    is_active: true,
  })
  const [editVariants, setEditVariants] = useState<ShopProductVariantRow[]>([])
  const [newEditVariant, setNewEditVariant] = useState<VariantDraft | null>(null)

  function loadEditVariants(productId: string) {
    startTransition(async () => {
      const result = await getShopProductVariants(productId)
      if (result.data) setEditVariants(result.data)
    })
  }

  async function handleUpload(files: File[], target: 'create' | 'edit') {
    if (files.length === 0) return
    startTransition(async () => {
      const uploadedUrls: string[] = []
      for (const file of files) {
        const optimized = await compressImageFile(file)
        const fd = new FormData()
        fd.append('file', optimized)
        const result = await uploadShopProductImage(fd)
        if (!result.url) {
          setMessage(result.error ?? '이미지 업로드 실패')
          return
        }
        uploadedUrls.push(result.url)
      }

      if (target === 'create') {
        setForm((prev) => {
          const merged = [...parseImageUrls(prev.image_url), ...uploadedUrls]
          return { ...prev, image_url: joinImageUrls(merged) }
        })
      } else {
        setEditForm((prev) => {
          const merged = [...parseImageUrls(prev.image_url), ...uploadedUrls]
          return { ...prev, image_url: joinImageUrls(merged) }
        })
      }
      setMessage(`상품 이미지를 ${uploadedUrls.length}장 업로드했습니다.`)
    })
  }

  function handleDelete(p: ProductRow) {
    if (!window.confirm(`'${p.name}' 상품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await deleteShopProduct(p.product_id)
      if (!result.success) return setMessage(result.error ?? '삭제 실패')
      if (editingId === p.product_id) setEditingId(null)
      setMessage('상품을 삭제했습니다.')
      router.refresh()
    })
  }

  const filteredProducts = products.filter((p) => {
    const matchesKeyword =
      keyword.trim() === '' ||
      p.name.toLowerCase().includes(keyword.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(keyword.toLowerCase())
    const matchesType = typeFilter === 'ALL' || p.product_type === typeFilter
    const matchesStatus =
      statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? p.is_active : !p.is_active)
    return matchesKeyword && matchesType && matchesStatus
  })

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">상품 등록</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="상품명" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.product_type} onChange={(e) => setForm((p) => ({ ...p, product_type: e.target.value as 'GOODS' | 'CREDIT_PACK' | 'ESG' }))}>
            <option value="GOODS">굿즈</option>
            <option value="CREDIT_PACK">V.Credit</option>
            <option value="ESG">ESG</option>
          </select>
          <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2" placeholder="설명" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <input type="text" inputMode="numeric" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="가격(Medal)" value={formatIntegerWithCommas(form.price_medal)} onChange={(e) => setForm((p) => ({ ...p, price_medal: Number(sanitizeIntegerInput(e.target.value) || 0) }))} />
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.has_variants}
              onChange={(e) => setForm((p) => ({ ...p, has_variants: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            색상/사이즈 옵션 사용
          </label>
          {!form.has_variants && (
            <input type="text" inputMode="numeric" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="재고(비우면 무제한)" value={formatIntegerWithCommas(form.stock)} onChange={(e) => setForm((p) => ({ ...p, stock: sanitizeIntegerInput(e.target.value) }))} />
          )}
          {form.has_variants && (
            <VariantDraftEditor tone="create" drafts={createVariantDrafts} onChange={setCreateVariantDrafts} />
          )}
          <ProductImageUploadBox
            imageUrl={form.image_url}
            borderTone="border-gray-200 bg-gray-50/30"
            fileTone="border-gray-200 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            disabled={isPending}
            onSelectFiles={(files) => void handleUpload(files, 'create')}
            onClear={() => setForm((prev) => ({ ...prev, image_url: '' }))}
          />
          {form.product_type === 'CREDIT_PACK' && (
            <input type="text" inputMode="numeric" className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2" placeholder="지급할 V.Credit" value={formatIntegerWithCommas(form.credit_amount)} onChange={(e) => setForm((p) => ({ ...p, credit_amount: Number(sanitizeIntegerInput(e.target.value) || 0) }))} />
          )}
        </div>
        <button
          type="button"
          disabled={isPending || !form.name.trim()}
          onClick={() => {
            setMessage(null)
            startTransition(async () => {
              const result = await createShopProduct({
                name: form.name,
                description: form.description,
                product_type: form.product_type,
                price_medal: form.price_medal,
                credit_amount: form.product_type === 'CREDIT_PACK' ? form.credit_amount : null,
                stock: form.stock.trim() === '' ? null : Number(sanitizeIntegerInput(form.stock)),
                has_variants: form.has_variants,
                image_url: form.image_url.trim() || null,
              })
              if (!result.success) return setMessage(result.error ?? '등록 실패')
              if (form.has_variants && result.product_id) {
                for (const d of createVariantDrafts) {
                  if (!d.color.trim() && !d.size.trim()) continue
                  await createShopProductVariant({
                    product_id: result.product_id,
                    color: d.color,
                    size: d.size,
                    stock: Number(sanitizeIntegerInput(d.stock) || '0'),
                  })
                }
              }
              setMessage('상품이 등록되었습니다.')
              setForm({
                name: '',
                description: '',
                product_type: 'GOODS',
                price_medal: 10,
                credit_amount: 1000,
                stock: '',
                has_variants: false,
                image_url: '',
              })
              setCreateVariantDrafts([])
              router.refresh()
            })
          }}
          className="mt-4 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? '저장 중...' : '상품 등록'}
        </button>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">등록 상품 목록</h3>
          <p className="text-xs text-gray-500">검색 결과 {filteredProducts.length}건</p>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="상품명/설명 검색"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'GOODS' | 'CREDIT_PACK' | 'ESG')}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="ALL">유형 전체</option>
            <option value="GOODS">굿즈</option>
            <option value="CREDIT_PACK">V.Credit</option>
            <option value="ESG">ESG</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="ALL">상태 전체</option>
            <option value="ACTIVE">노출중</option>
            <option value="INACTIVE">숨김</option>
          </select>
        </div>
        {filteredProducts.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            조건에 맞는 상품이 없습니다.
          </div>
        )}
        <div className="space-y-3 md:hidden">
          {filteredProducts.map((p) => (
            <article key={p.product_id} className="rounded-xl border border-gray-200 bg-white p-4">
              {(() => {
                const previewUrls = parseImageUrls(p.image_url ?? '')
                const previewUrl = previewUrls[0] ?? null
                return (
                  <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{p.name}</h4>
                  <p className="mt-1 text-xs text-gray-500">{p.description ?? '설명 없음'}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await toggleShopProductActive(p.product_id, !p.is_active)
                        if (!result.success) return setMessage(result.error ?? '상태 변경 실패')
                        setMessage(p.is_active ? '상품을 숨겼습니다.' : '상품을 다시 노출했습니다.')
                        router.refresh()
                      })
                    }}
                    className={`btn-press rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${p.is_active ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                  >
                    {p.is_active ? '숨김' : '노출'}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setEditingId(p.product_id)
                      setEditForm({
                        name: p.name,
                        description: p.description ?? '',
                        product_type: p.product_type,
                        price_medal: p.price_medal,
                        credit_amount: p.credit_amount ?? 1000,
                        stock: p.stock == null ? '' : String(p.stock),
                        has_variants: p.has_variants,
                        image_url: p.image_url ?? '',
                        is_active: p.is_active,
                      })
                      setEditVariants([])
                      setNewEditVariant(null)
                      if (p.has_variants) loadEditVariants(p.product_id)
                    }}
                    className="btn-press rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(p)}
                    className="btn-press rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
              {previewUrl && (
                <div className="relative mt-3 h-32 overflow-hidden rounded-lg border border-gray-200">
                  <Image src={previewUrl} alt={`${p.name} 썸네일`} fill sizes="(max-width: 768px) 100vw, 320px" unoptimized className="object-cover" />
                </div>
              )}
              {previewUrls.length > 1 && (
                <p className="mt-1 text-[11px] font-medium text-gray-500">이미지 {previewUrls.length}장 등록됨</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                  <p className="text-gray-500">유형</p>
                  <p className="mt-1 font-semibold text-gray-800">
                    {p.product_type === 'CREDIT_PACK' ? 'V.Credit' : p.product_type === 'ESG' ? 'ESG' : '굿즈'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-right">
                  <p className="text-gray-500">가격(M)</p>
                  <p className="mt-1 font-semibold text-purple-700">{p.price_medal.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-right">
                  <p className="text-gray-500">지급(C)</p>
                  <p className="mt-1 font-semibold text-emerald-700">{(p.credit_amount ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-right">
                  <p className="text-gray-500">재고</p>
                  <p className="mt-1 font-semibold text-gray-800">
                    {p.has_variants ? '옵션별 관리' : p.stock == null ? '무제한' : p.stock.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {p.is_active ? '노출중' : '숨김'}
                </span>
              </div>
                  </>
                )
              })()}
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">상품명</th>
              <th className="px-4 py-3">유형</th>
              <th className="px-4 py-3 text-right">가격(M)</th>
              <th className="px-4 py-3 text-right">지급(C)</th>
              <th className="px-4 py-3 text-right">재고</th>
              <th className="px-4 py-3">이미지</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map((p) => (
              <tr key={p.product_id}>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3">{p.product_type === 'CREDIT_PACK' ? 'V.Credit' : p.product_type === 'ESG' ? 'ESG' : '굿즈'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.price_medal.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{(p.credit_amount ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.has_variants ? '옵션별 관리' : p.stock == null ? '무제한' : p.stock.toLocaleString()}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const previewUrls = parseImageUrls(p.image_url ?? '')
                    const previewUrl = previewUrls[0] ?? null
                    if (!previewUrl) {
                      return <span className="text-xs text-gray-400">없음</span>
                    }
                    return (
                    <div className="relative h-10 w-16 overflow-hidden rounded-md border border-gray-200">
                      <Image src={previewUrl} alt={`${p.name} 썸네일`} fill sizes="64px" unoptimized className="object-cover" />
                    </div>
                    )
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {p.is_active ? '노출중' : '숨김'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await toggleShopProductActive(p.product_id, !p.is_active)
                          if (!result.success) return setMessage(result.error ?? '상태 변경 실패')
                          setMessage(p.is_active ? '상품을 숨겼습니다.' : '상품을 다시 노출했습니다.')
                          router.refresh()
                        })
                      }}
                      className={`btn-press rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${p.is_active ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                    >
                      {p.is_active ? '숨김' : '노출'}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setEditingId(p.product_id)
                        setEditForm({
                          name: p.name,
                          description: p.description ?? '',
                          product_type: p.product_type,
                          price_medal: p.price_medal,
                          credit_amount: p.credit_amount ?? 1000,
                          stock: p.stock == null ? '' : String(p.stock),
                          has_variants: p.has_variants,
                          image_url: p.image_url ?? '',
                          is_active: p.is_active,
                        })
                        setEditVariants([])
                        setNewEditVariant(null)
                        if (p.has_variants) loadEditVariants(p.product_id)
                      }}
                      className="btn-press rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(p)}
                      className="btn-press rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {editingId && (
        <section className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-green-900">상품 수정</h3>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-100"
              onClick={() => setEditingId(null)}
            >
              닫기
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
              placeholder="상품명"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <select
              className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
              value={editForm.product_type}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, product_type: e.target.value as 'GOODS' | 'CREDIT_PACK' | 'ESG' }))
              }
            >
              <option value="GOODS">굿즈</option>
              <option value="CREDIT_PACK">V.Credit</option>
              <option value="ESG">ESG</option>
            </select>
            <input
              className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="설명"
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <input
              type="text"
              inputMode="numeric"
              className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
              placeholder="가격(Medal)"
              value={formatIntegerWithCommas(editForm.price_medal)}
              onChange={(e) => setEditForm((prev) => ({ ...prev, price_medal: Number(sanitizeIntegerInput(e.target.value) || 0) }))}
            />
            <label className="flex items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editForm.has_variants}
                onChange={(e) => {
                  const checked = e.target.checked
                  setEditForm((prev) => ({ ...prev, has_variants: checked }))
                  if (checked && editingId) loadEditVariants(editingId)
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              색상/사이즈 옵션 사용
            </label>
            {!editForm.has_variants && (
              <input
                type="text"
                inputMode="numeric"
                className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
                placeholder="재고(비우면 무제한)"
                value={formatIntegerWithCommas(editForm.stock)}
                onChange={(e) => setEditForm((prev) => ({ ...prev, stock: sanitizeIntegerInput(e.target.value) }))}
              />
            )}
            {editForm.has_variants && editingId && (
              <div className="space-y-2 rounded-xl border border-green-200 bg-white p-3 md:col-span-2">
                <p className="text-xs font-semibold text-gray-600">색상/사이즈 옵션별 재고</p>
                {editVariants.length === 0 && (
                  <p className="text-xs text-gray-400">등록된 옵션이 없습니다. 아래에서 추가하세요.</p>
                )}
                {editVariants.map((v, idx) => (
                  <div key={v.variant_id} className="flex flex-wrap items-center gap-2">
                    <input
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      placeholder="색상"
                      value={v.color ?? ''}
                      onChange={(e) => {
                        const next = [...editVariants]
                        next[idx] = { ...v, color: e.target.value }
                        setEditVariants(next)
                      }}
                    />
                    <input
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      placeholder="사이즈"
                      value={v.size ?? ''}
                      onChange={(e) => {
                        const next = [...editVariants]
                        next[idx] = { ...v, size: e.target.value }
                        setEditVariants(next)
                      }}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      placeholder="재고"
                      value={formatIntegerWithCommas(v.stock)}
                      onChange={(e) => {
                        const next = [...editVariants]
                        next[idx] = { ...v, stock: Number(sanitizeIntegerInput(e.target.value) || '0') }
                        setEditVariants(next)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...editVariants]
                        next[idx] = { ...v, is_active: !v.is_active }
                        setEditVariants(next)
                      }}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {v.is_active ? '판매중' : '비활성'}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await updateShopProductVariant({
                            variant_id: v.variant_id,
                            color: v.color,
                            size: v.size,
                            stock: v.stock,
                            is_active: v.is_active,
                          })
                          if (!result.success) return setMessage(result.error ?? '옵션 저장 실패')
                          setMessage('옵션을 저장했습니다.')
                          router.refresh()
                        })
                      }}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await deleteShopProductVariant(v.variant_id)
                          if (!result.success) return setMessage(result.error ?? '옵션 삭제 실패')
                          setEditVariants(editVariants.filter((item) => item.variant_id !== v.variant_id))
                          setMessage('옵션을 삭제했습니다.')
                          router.refresh()
                        })
                      }}
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                ))}
                {newEditVariant ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      placeholder="색상"
                      value={newEditVariant.color}
                      onChange={(e) => setNewEditVariant({ ...newEditVariant, color: e.target.value })}
                    />
                    <input
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      placeholder="사이즈"
                      value={newEditVariant.size}
                      onChange={(e) => setNewEditVariant({ ...newEditVariant, size: e.target.value })}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      placeholder="재고"
                      value={formatIntegerWithCommas(newEditVariant.stock)}
                      onChange={(e) => setNewEditVariant({ ...newEditVariant, stock: sanitizeIntegerInput(e.target.value) })}
                    />
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await createShopProductVariant({
                            product_id: editingId,
                            color: newEditVariant.color,
                            size: newEditVariant.size,
                            stock: Number(sanitizeIntegerInput(newEditVariant.stock) || '0'),
                          })
                          if (!result.success) return setMessage(result.error ?? '옵션 추가 실패')
                          setNewEditVariant(null)
                          loadEditVariants(editingId)
                          setMessage('옵션을 추가했습니다.')
                          router.refresh()
                        })
                      }}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEditVariant(null)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNewEditVariant({ key: 'new', color: '', size: '', stock: '0' })}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    옵션 추가
                  </button>
                )}
              </div>
            )}
            <ProductImageUploadBox
              imageUrl={editForm.image_url}
              borderTone="border-green-200 bg-green-100/30"
              fileTone="border-green-200 bg-white file:bg-green-100 file:text-green-800 hover:file:bg-green-200"
              disabled={isPending}
              onSelectFiles={(files) => void handleUpload(files, 'edit')}
              onClear={() => setEditForm((prev) => ({ ...prev, image_url: '' }))}
            />
            {editForm.product_type === 'CREDIT_PACK' && (
              <input
                type="text"
                inputMode="numeric"
                className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm md:col-span-2"
                placeholder="지급할 V.Credit"
                value={formatIntegerWithCommas(editForm.credit_amount)}
                onChange={(e) => setEditForm((prev) => ({ ...prev, credit_amount: Number(sanitizeIntegerInput(e.target.value) || 0) }))}
              />
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isPending || !editForm.name.trim()}
              onClick={() => {
                startTransition(async () => {
                  const result = await updateShopProduct({
                    product_id: editingId,
                    name: editForm.name,
                    description: editForm.description,
                    product_type: editForm.product_type,
                    price_medal: editForm.price_medal,
                    credit_amount: editForm.product_type === 'CREDIT_PACK' ? editForm.credit_amount : null,
                    stock: editForm.stock.trim() === '' ? null : Number(sanitizeIntegerInput(editForm.stock)),
                    has_variants: editForm.has_variants,
                    image_url: editForm.image_url.trim() || null,
                    is_active: editForm.is_active,
                  })
                  if (!result.success) return setMessage(result.error ?? '수정 실패')
                  setMessage('상품 정보를 수정했습니다.')
                  setEditingId(null)
                  router.refresh()
                })
              }}
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? '저장 중...' : '수정 저장'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setEditingId(null)
              }}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
