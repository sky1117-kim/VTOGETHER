'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { purchaseShopProduct } from '@/api/actions/shop'

type ShopProduct = {
  product_id: string
  name: string
  description: string | null
  product_type: 'GOODS' | 'CREDIT_PACK' | 'ALMAENG_STORE'
  price_medal: number
  credit_amount: number | null
  stock: number | null
  image_url: string | null
  order_count: number
  is_new: boolean
  is_best: boolean
}

function parseProductImageUrls(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function ShopProductList({
  products,
  currentMedals,
}: {
  products: ShopProduct[]
  currentMedals: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [expandedDescriptionProductId, setExpandedDescriptionProductId] = useState<string | null>(null)
  const [expandedImageIndex, setExpandedImageIndex] = useState(0)
  const [sortBy, setSortBy] = useState<'POPULAR' | 'LATEST'>('POPULAR')
  const [productTypeFilter, setProductTypeFilter] = useState<'ALL' | 'GOODS' | 'CREDIT_PACK' | 'ALMAENG_STORE'>('ALL')
  const [showSkeleton, setShowSkeleton] = useState(true)
  const [imageIndexByProductId, setImageIndexByProductId] = useState<Record<string, number>>({})
  const [touchStartXByProductId, setTouchStartXByProductId] = useState<Record<string, number>>({})

  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(false), 320)
    return () => clearTimeout(timer)
  }, [])

  const visibleProducts = useMemo(() => {
    const copied =
      productTypeFilter === 'ALL'
        ? [...products]
        : products.filter((item) => item.product_type === productTypeFilter)
    if (sortBy === 'POPULAR') {
      copied.sort((a, b) => {
        const scoreA = (a.order_count ?? 0) + (a.is_best ? 100000 : 0)
        const scoreB = (b.order_count ?? 0) + (b.is_best ? 100000 : 0)
        return scoreB - scoreA
      })
      return copied
    }
    if (sortBy === 'LATEST') {
      copied.sort((a, b) => {
        const scoreA = (a.is_new ? 100000 : 0) + (a.order_count ?? 0)
        const scoreB = (b.is_new ? 100000 : 0) + (b.order_count ?? 0)
        return scoreB - scoreA
      })
      return copied
    }
    return copied
  }, [products, sortBy, productTypeFilter])

  const gridClass = 'grid items-start gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="space-y-4">
      {message && (
        <div className="glass rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-soft">
          {message}
        </div>
      )}
      <section
        className="animate-fade-up flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2"
        style={{ animationDelay: '0.06s' }}
      >
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-1">
          <span className="px-2 text-[10px] font-bold text-slate-500">정렬</span>
          {[
            { key: 'POPULAR', label: '인기순' },
            { key: 'LATEST', label: '최신순' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSortBy(tab.key as 'POPULAR' | 'LATEST')}
              className={`btn-press rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                sortBy === tab.key
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-1">
          <span className="px-2 text-[10px] font-bold text-slate-500">유형</span>
          {[
            { key: 'ALL', label: '전체' },
            { key: 'GOODS', label: '굿즈' },
            { key: 'CREDIT_PACK', label: 'V.Credit' },
            { key: 'ALMAENG_STORE', label: '알맹상점' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setProductTypeFilter(tab.key as 'ALL' | 'GOODS' | 'CREDIT_PACK' | 'ALMAENG_STORE')}
              className={`btn-press rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${
                productTypeFilter === tab.key
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>
      {showSkeleton ? (
        <div
          className="animate-fade-up grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3"
          style={{ animationDelay: '0.16s' }}
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`shop-skeleton-${idx}`}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft"
            >
              <div className="h-30 animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100" />
                <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-8 animate-pulse rounded-xl bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className={`animate-fade-up ${gridClass}`} style={{ animationDelay: '0.16s' }}>
        {visibleProducts.map((p, idx) => {
          const soldOut = p.stock != null && p.stock <= 0
          const disabled = isPending || soldOut || currentMedals < p.price_medal
          return (
            <article
              key={p.product_id}
              onClick={() => {
                setExpandedDescriptionProductId(p.product_id)
                setExpandedImageIndex(imageIndexByProductId[p.product_id] ?? 0)
              }}
              className="animate-fade-up group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-white px-2.5 pb-2.5 pt-2.5 shadow-md shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-slate-300/70"
              style={{ animationDelay: `${180 + idx * 60}ms` }}
            >
              {(() => {
                const imageUrls = parseProductImageUrls(p.image_url)
                const imageCount = imageUrls.length
                const currentImageIndex = Math.min(imageIndexByProductId[p.product_id] ?? 0, Math.max(imageCount - 1, 0))
                return (
              <div
                className="relative mb-2 aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
                onTouchStart={(e) => {
                  const x = e.touches[0]?.clientX
                  if (x == null) return
                  setTouchStartXByProductId((prev) => ({ ...prev, [p.product_id]: x }))
                }}
                onTouchEnd={(e) => {
                  const startX = touchStartXByProductId[p.product_id]
                  const endX = e.changedTouches[0]?.clientX
                  if (startX == null || endX == null || imageCount <= 1) return
                  const deltaX = endX - startX
                  const swipeThreshold = 36
                  if (Math.abs(deltaX) < swipeThreshold) return
                  setImageIndexByProductId((prev) => ({
                    ...prev,
                    [p.product_id]:
                      deltaX < 0
                        ? (currentImageIndex + 1) % imageCount
                        : (currentImageIndex - 1 + imageCount) % imageCount,
                  }))
                  setTouchStartXByProductId((prev) => {
                    const next = { ...prev }
                    delete next[p.product_id]
                    return next
                  })
                }}
              >
                {imageCount > 0 ? (
                  <div
                    className="flex h-full w-full transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                  >
                    {imageUrls.map((url, imageIdx) => (
                      <div key={`${p.product_id}-${url}-${imageIdx}`} className="relative h-full min-w-full">
                        <Image
                          src={url}
                          alt={`${p.name} 상품 이미지 ${imageIdx + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                          unoptimized
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                    이미지 준비 중
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
                <div className="absolute left-2 top-2 flex items-center gap-1">
                  {p.is_best && (
                    <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[9px] font-black tracking-wider text-white shadow-sm">
                      BEST
                    </span>
                  )}
                  {p.is_new && (
                    <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-[9px] font-black tracking-wider text-white shadow-sm">
                      NEW
                    </span>
                  )}
                </div>
                <div className="absolute right-2 top-2 rounded-md border border-white/20 bg-black/45 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                  {p.stock == null ? '재고 무제한' : `재고 ${p.stock.toLocaleString()}개`}
                </div>
                {imageCount > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setImageIndexByProductId((prev) => ({
                          ...prev,
                          [p.product_id]: (currentImageIndex - 1 + imageCount) % imageCount,
                        }))
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition hover:bg-black/60"
                      aria-label={`${p.name} 이전 이미지`}
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setImageIndexByProductId((prev) => ({
                          ...prev,
                          [p.product_id]: (currentImageIndex + 1) % imageCount,
                        }))
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition hover:bg-black/60"
                      aria-label={`${p.name} 다음 이미지`}
                    >
                      ▶
                    </button>
                    <div className="absolute bottom-2 right-2 rounded-md border border-white/30 bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      {currentImageIndex + 1}/{imageCount}
                    </div>
                  </>
                )}
              </div>
                )
              })()}
              <div className="flex h-full flex-col">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-[17px] font-black leading-[1.25] tracking-tight text-slate-900">
                    {p.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${
                      p.product_type === 'CREDIT_PACK'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : p.product_type === 'ALMAENG_STORE'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-blue-200 bg-blue-50 text-blue-700'
                    }`}
                  >
                    {p.product_type === 'CREDIT_PACK' ? 'V.Credit' : p.product_type === 'ALMAENG_STORE' ? '알맹상점' : '굿즈'}
                  </span>
                </div>
                <div className="mb-2 h-px w-full bg-slate-300/80" />
                <p className="mb-5 line-clamp-2 text-[12px] font-medium leading-[1.4] text-slate-600 break-words">
                  {p.description ?? '설명 없음'}
                </p>
                <div className="mb-4 rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-500">필요 메달</span>
                    <p className="inline-flex items-baseline gap-1.5 text-emerald-900">
                      <span className="text-[24px] font-black leading-none tracking-tight tabular-nums text-emerald-900">
                        {p.price_medal.toLocaleString()}
                      </span>
                      <span className="rounded-md border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold leading-none text-emerald-900">
                        Medal
                      </span>
                    </p>
                  </div>
                </div>
                {currentMedals < p.price_medal && (
                  <p className="mb-2 text-center text-[10px] font-bold tracking-tight text-orange-500">
                    보유 메달이 부족해 현재 교환할 수 없습니다.
                  </p>
                )}
                {currentMedals >= p.price_medal && <div className="mb-2" />}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMessage(null)
                    startTransition(async () => {
                      const result = await purchaseShopProduct(p.product_id)
                      if (!result.success) {
                        setMessage(result.error ?? '구매 실패')
                        return
                      }
                      setMessage(`${p.name} 교환이 완료되었습니다.`)
                      router.refresh()
                    })
                  }}
                  className="mb-0 w-full rounded-xl bg-emerald-600 px-3 py-1.5 text-[12px] font-extrabold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {soldOut ? '품절' : isPending ? '처리 중...' : '교환하기'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
      )}
      {expandedDescriptionProductId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setExpandedDescriptionProductId(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const product = visibleProducts.find((item) => item.product_id === expandedDescriptionProductId)
              if (!product) return null
              const imageUrls = parseProductImageUrls(product.image_url)
              const imageCount = imageUrls.length
              const modalImageIndex = Math.min(expandedImageIndex, Math.max(imageCount - 1, 0))
              return (
                <>
                  <h3 className="text-lg font-black text-slate-900">{product.name}</h3>
                  {imageCount > 0 && (
                    <div className="mt-3">
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <div
                          className="flex h-full w-full transition-transform duration-500 ease-out"
                          style={{ transform: `translateX(-${modalImageIndex * 100}%)` }}
                        >
                          {imageUrls.map((url, idx) => (
                            <div key={`${product.product_id}-modal-${url}-${idx}`} className="relative h-full min-w-full">
                              <Image
                                src={url}
                                alt={`${product.name} 확대 이미지 ${idx + 1}`}
                                fill
                                sizes="(max-width: 768px) 100vw, 640px"
                                unoptimized
                                className="object-cover"
                              />
                            </div>
                          ))}
                        </div>
                        {imageCount > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedImageIndex((modalImageIndex - 1 + imageCount) % imageCount)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition hover:bg-black/60"
                              aria-label={`${product.name} 이전 확대 이미지`}
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedImageIndex((modalImageIndex + 1) % imageCount)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition hover:bg-black/60"
                              aria-label={`${product.name} 다음 확대 이미지`}
                            >
                              ▶
                            </button>
                            <div className="absolute bottom-2 right-2 rounded-md border border-white/30 bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                              {modalImageIndex + 1}/{imageCount}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="mt-3 max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {product.description ?? '설명 없음'}
                  </p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setExpandedDescriptionProductId(null)}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      닫기
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
      {!showSkeleton && visibleProducts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm font-semibold text-slate-500">
          조건에 맞는 상품이 없습니다.
        </div>
      )}
    </div>
  )
}
