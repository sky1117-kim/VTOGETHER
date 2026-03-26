'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { purchaseShopProduct } from '@/api/actions/shop'

type ShopProduct = {
  product_id: string
  name: string
  description: string | null
  product_type: 'GOODS' | 'CREDIT_PACK'
  price_medal: number
  credit_amount: number | null
  stock: number | null
  image_url: string | null
  order_count: number
  is_new: boolean
  is_best: boolean
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
  const [sortBy, setSortBy] = useState<'POPULAR' | 'LATEST' | 'PRICE_LOW' | 'PRICE_HIGH'>('POPULAR')
  const [showSkeleton, setShowSkeleton] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(false), 320)
    return () => clearTimeout(timer)
  }, [])

  const visibleProducts = useMemo(() => {
    const copied = [...products]
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
    if (sortBy === 'PRICE_LOW') {
      copied.sort((a, b) => a.price_medal - b.price_medal)
      return copied
    }
    copied.sort((a, b) => b.price_medal - a.price_medal)
    return copied
  }, [products, sortBy])

  const gridClass =
    visibleProducts.length <= 2
      ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-2'
      : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="space-y-5">
      {message && (
        <div className="glass rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-soft">
          {message}
        </div>
      )}
      <section className="animate-fade-up grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        <div className="rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="text-xs font-bold text-slate-500">내 보유 V.Medal</p>
          <p className="mt-1 text-lg font-black text-purple-600">{currentMedals.toLocaleString()} M</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="text-xs font-bold text-slate-500">구매 안내</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">굿즈는 재고가 소진되면 품절됩니다.</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="text-xs font-bold text-slate-500">전환 상품 안내</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">V.Credit 전환팩은 즉시 포인트로 지급됩니다.</p>
        </div>
      </section>
      <section className="animate-fade-up flex flex-wrap items-center gap-2" style={{ animationDelay: '0.06s' }}>
        {[
          { key: 'POPULAR', label: '인기순' },
          { key: 'LATEST', label: '최신순' },
          { key: 'PRICE_LOW', label: '가격 낮은순' },
          { key: 'PRICE_HIGH', label: '가격 높은순' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSortBy(tab.key as 'POPULAR' | 'LATEST' | 'PRICE_LOW' | 'PRICE_HIGH')}
            className={`btn-press rounded-full px-4 py-2 text-xs font-extrabold transition ${
              sortBy === tab.key
                ? 'border border-transparent bg-green-600 text-white shadow-md shadow-green-100'
                : 'border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </section>
      {showSkeleton ? (
        <div className="animate-fade-up grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ animationDelay: '0.16s' }}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`shop-skeleton-${idx}`}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft"
            >
              <div className="h-44 animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100" />
              <div className="space-y-3 p-5">
                <div className="h-5 w-2/3 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-gray-100" />
                <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-10 animate-pulse rounded-xl bg-gray-200" />
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
              className="animate-fade-up group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-green-200 hover:shadow-xl hover:shadow-slate-100"
              style={{ animationDelay: `${180 + idx * 60}ms` }}
            >
              <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-[1.25rem] border border-slate-100 bg-slate-50">
                {p.image_url?.trim() ? (
                  <Image
                    src={p.image_url}
                    alt={`${p.name} 상품 이미지`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
                    이미지 준비 중
                  </div>
                )}
                <div className="absolute left-3 top-3 flex items-center gap-1.5">
                  {p.is_best && (
                    <span className="rounded bg-amber-500 px-2.5 py-1 text-[10px] font-black tracking-wider text-white shadow-sm">
                      BEST
                    </span>
                  )}
                  {p.is_new && (
                    <span className="rounded bg-emerald-500 px-2.5 py-1 text-[10px] font-black tracking-wider text-white shadow-sm">
                      NEW
                    </span>
                  )}
                </div>
                <div className="absolute right-3 top-3 rounded bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                  {p.stock == null ? '재고 무제한' : `재고 ${p.stock.toLocaleString()}개`}
                </div>
              </div>
              <div className="flex flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-[17px] font-extrabold leading-tight text-slate-900">{p.name}</h3>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                      p.product_type === 'CREDIT_PACK'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-blue-200 bg-blue-50 text-blue-700'
                    }`}
                  >
                    {p.product_type === 'CREDIT_PACK' ? 'V.Credit 전환' : '굿즈'}
                  </span>
                </div>
                <p className="mb-4 min-h-10 text-[12px] font-medium text-slate-500">{p.description ?? '설명 없음'}</p>
                <div className="mb-4 space-y-1.5 text-sm">
                  <div className="flex items-center">
                    <span className="w-[72px] text-[13px] font-bold text-slate-500">가격:</span>
                    <span className="text-[14px] font-black text-purple-600">{p.price_medal.toLocaleString()} M</span>
                  </div>
                  {p.product_type === 'CREDIT_PACK' && (
                    <div className="flex items-center">
                      <span className="w-[72px] text-[13px] font-bold text-slate-500">지급:</span>
                      <span className="text-[13px] font-bold text-slate-800">{(p.credit_amount ?? 0).toLocaleString()} P</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <span className="w-[72px] text-[13px] font-bold text-slate-500">누적 구매:</span>
                    <span className="text-[13px] font-bold text-slate-800">{(p.order_count ?? 0).toLocaleString()}건</span>
                  </div>
                </div>
                {currentMedals < p.price_medal && (
                  <p className="mb-2.5 text-center text-[11px] font-bold tracking-tight text-orange-500">
                    보유 메달이 부족해 현재 구매할 수 없습니다.
                  </p>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setMessage(null)
                    startTransition(async () => {
                      const result = await purchaseShopProduct(p.product_id)
                      if (!result.success) {
                        setMessage(result.error ?? '구매 실패')
                        return
                      }
                      setMessage(`${p.name} 구매가 완료되었습니다.`)
                      router.refresh()
                    })
                  }}
                  className="w-full rounded-xl bg-green-600 px-4 py-3 text-[14px] font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {soldOut ? '품절' : isPending ? '처리 중...' : '구매하기'}
                </button>
              </div>
            </article>
          )
        })}
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
