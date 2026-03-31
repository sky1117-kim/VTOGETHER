'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  createShopProduct,
  toggleShopProductActive,
  updateShopProduct,
  uploadShopProductImage,
} from '@/api/actions/admin/shop-products'
import { useRouter } from 'next/navigation'
import { formatIntegerWithCommas, sanitizeIntegerInput } from '@/lib/number-format'

type ProductRow = {
  product_id: string
  name: string
  description: string | null
  product_type: 'GOODS' | 'CREDIT_PACK'
  price_medal: number
  credit_amount: number | null
  stock: number | null
  image_url: string | null
  is_active: boolean
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
  onSelectFile,
  onClear,
}: {
  imageUrl: string
  borderTone: string
  fileTone: string
  disabled: boolean
  onSelectFile: (file: File | null) => void
  onClear: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
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
          onSelectFile(e.dataTransfer.files?.[0] ?? null)
        }}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            type="file"
            disabled={disabled}
            accept="image/png,image/jpeg,image/webp,image/gif"
            className={`block w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-semibold ${fileTone}`}
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />
          {imageUrl && (
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
        <p className="mt-2 text-xs text-gray-500">파일을 끌어다 놓아도 업로드됩니다. (자동 압축 적용)</p>
      </div>
      {imageUrl && (
        <div className="relative h-40 overflow-hidden rounded-xl border border-gray-200">
          <Image src={imageUrl} alt="상품 미리보기" fill sizes="(max-width: 768px) 100vw, 640px" unoptimized className="object-cover" />
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
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GOODS' | 'CREDIT_PACK'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [form, setForm] = useState({
    name: '',
    description: '',
    product_type: 'GOODS' as 'GOODS' | 'CREDIT_PACK',
    price_medal: 10,
    credit_amount: 1000,
    stock: '',
    image_url: '',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    product_type: 'GOODS' as 'GOODS' | 'CREDIT_PACK',
    price_medal: 10,
    credit_amount: 1000,
    stock: '',
    image_url: '',
    is_active: true,
  })

  async function handleUpload(file: File | null, target: 'create' | 'edit') {
    if (!file) return
    const optimized = await compressImageFile(file)
    const fd = new FormData()
    fd.append('file', optimized)
    startTransition(async () => {
      const result = await uploadShopProductImage(fd)
      if (!result.url) {
        setMessage(result.error ?? '이미지 업로드 실패')
        return
      }
      if (target === 'create') {
        setForm((prev) => ({ ...prev, image_url: result.url ?? '' }))
      } else {
        setEditForm((prev) => ({ ...prev, image_url: result.url ?? '' }))
      }
      setMessage('상품 이미지를 업로드했습니다.')
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
          <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.product_type} onChange={(e) => setForm((p) => ({ ...p, product_type: e.target.value as 'GOODS' | 'CREDIT_PACK' }))}>
            <option value="GOODS">굿즈</option>
            <option value="CREDIT_PACK">V.Credit 전환팩</option>
          </select>
          <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2" placeholder="설명" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <input type="text" inputMode="numeric" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="가격(Medal)" value={formatIntegerWithCommas(form.price_medal)} onChange={(e) => setForm((p) => ({ ...p, price_medal: Number(sanitizeIntegerInput(e.target.value) || 0) }))} />
          <input type="text" inputMode="numeric" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="재고(비우면 무제한)" value={formatIntegerWithCommas(form.stock)} onChange={(e) => setForm((p) => ({ ...p, stock: sanitizeIntegerInput(e.target.value) }))} />
          <ProductImageUploadBox
            imageUrl={form.image_url}
            borderTone="border-gray-200 bg-gray-50/30"
            fileTone="border-gray-200 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            disabled={isPending}
            onSelectFile={(file) => void handleUpload(file, 'create')}
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
                image_url: form.image_url.trim() || null,
              })
              if (!result.success) return setMessage(result.error ?? '등록 실패')
              setMessage('상품이 등록되었습니다.')
              setForm({
                name: '',
                description: '',
                product_type: 'GOODS',
                price_medal: 10,
                credit_amount: 1000,
                stock: '',
                image_url: '',
              })
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
            onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'GOODS' | 'CREDIT_PACK')}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="ALL">유형 전체</option>
            <option value="GOODS">굿즈</option>
            <option value="CREDIT_PACK">V.Credit 전환팩</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="ALL">상태 전체</option>
            <option value="ACTIVE">판매중</option>
            <option value="INACTIVE">비활성</option>
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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{p.name}</h4>
                  <p className="mt-1 text-xs text-gray-500">{p.description ?? '설명 없음'}</p>
                </div>
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
                      image_url: p.image_url ?? '',
                      is_active: p.is_active,
                    })
                  }}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  수정
                </button>
              </div>
              {p.image_url && (
                <div className="relative mt-3 h-32 overflow-hidden rounded-lg border border-gray-200">
                  <Image src={p.image_url} alt={`${p.name} 썸네일`} fill sizes="(max-width: 768px) 100vw, 320px" unoptimized className="object-cover" />
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                  <p className="text-gray-500">유형</p>
                  <p className="mt-1 font-semibold text-gray-800">
                    {p.product_type === 'CREDIT_PACK' ? 'V.Credit 전환' : '굿즈'}
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
                  <p className="mt-1 font-semibold text-gray-800">{p.stock == null ? '무제한' : p.stock.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await toggleShopProductActive(p.product_id, !p.is_active)
                      if (!result.success) return setMessage(result.error ?? '상태 변경 실패')
                      setMessage('상품 상태를 변경했습니다.')
                      router.refresh()
                    })
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {p.is_active ? '판매중' : '비활성'}
                </button>
              </div>
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
                <td className="px-4 py-3">{p.product_type === 'CREDIT_PACK' ? 'V.Credit 전환' : '굿즈'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.price_medal.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{(p.credit_amount ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.stock == null ? '무제한' : p.stock.toLocaleString()}</td>
                <td className="px-4 py-3">
                  {p.image_url ? (
                    <div className="relative h-10 w-16 overflow-hidden rounded-md border border-gray-200">
                      <Image src={p.image_url} alt={`${p.name} 썸네일`} fill sizes="64px" unoptimized className="object-cover" />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">없음</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await toggleShopProductActive(p.product_id, !p.is_active)
                        if (!result.success) return setMessage(result.error ?? '상태 변경 실패')
                        setMessage('상품 상태를 변경했습니다.')
                        router.refresh()
                      })
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {p.is_active ? '판매중' : '비활성'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
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
                        image_url: p.image_url ?? '',
                        is_active: p.is_active,
                      })
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    수정
                  </button>
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
                setEditForm((prev) => ({ ...prev, product_type: e.target.value as 'GOODS' | 'CREDIT_PACK' }))
              }
            >
              <option value="GOODS">굿즈</option>
              <option value="CREDIT_PACK">V.Credit 전환팩</option>
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
            <input
              type="text"
              inputMode="numeric"
              className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm"
              placeholder="재고(비우면 무제한)"
              value={formatIntegerWithCommas(editForm.stock)}
              onChange={(e) => setEditForm((prev) => ({ ...prev, stock: sanitizeIntegerInput(e.target.value) }))}
            />
            <ProductImageUploadBox
              imageUrl={editForm.image_url}
              borderTone="border-green-200 bg-green-100/30"
              fileTone="border-green-200 bg-white file:bg-green-100 file:text-green-800 hover:file:bg-green-200"
              disabled={isPending}
              onSelectFile={(file) => void handleUpload(file, 'edit')}
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
