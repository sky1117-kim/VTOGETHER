import Link from 'next/link'
import { getCurrentUser } from '@/api/actions/auth'
import { getShopProducts } from '@/api/actions/shop'
import { ShopProductList } from './ShopProductList'

export default async function ShopPage() {
  const user = await getCurrentUser()
  const { data: products, error } = await getShopProducts()

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="glass rounded-2xl border border-gray-200 bg-white/90 p-8 text-center shadow-soft">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">V.Medal 상점</h1>
          <p className="mt-2 text-sm font-medium text-gray-600">로그인 후 상점을 이용할 수 있습니다.</p>
          <Link
            href="/login"
            className="btn-press mt-5 inline-block rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
          >
            로그인하기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-2 sm:px-6 lg:px-8">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-8 shadow-soft-lg">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-emerald-300/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-emerald-100">
              V.Together Store
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">V.Medal 상점</h1>
            <p className="mt-1.5 text-[13px] font-semibold text-slate-200">
              V.Medal로 다양한 상품을 구매하거나 V.Credit으로 전환할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm backdrop-blur">
            <span className="text-[13px] font-bold text-slate-200">내 보유 V.Medal</span>
            <strong className="text-lg font-black tracking-tight text-fuchsia-200">
              {(user.current_medals ?? 0).toLocaleString()} M
            </strong>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/15 pt-5 text-[12px] font-semibold text-slate-200">
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
            굿즈는 재고 소진 시 자동 품절 처리
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
            전환 상품은 구매 즉시 V.Credit 지급
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
            BEST/NEW 뱃지로 인기 상품 빠르게 확인
          </div>
        </div>
        <div className="relative mt-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-[12px] leading-6 text-slate-100 backdrop-blur-sm">
          <p className="font-semibold text-emerald-100">
            일부 상품은 제로웨이스트 숍 알맹상점의 제품으로 구성되어 있습니다.
          </p>
          <p className="mt-1.5 text-[11px] text-slate-200">
            알맹상점은 ‘껍데기는 줄이고, 알맹이만 소비하자’는 취지로 시작된 친환경 브랜드로, 불필요한 포장재를 최소화하고
            재사용·재활용이 가능한 제품을 선보이며 지속가능한 소비 문화를 제안하고 있습니다.
          </p>
        </div>
      </section>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="section-title flex items-center gap-3 text-gray-900">
            <span className="h-8 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
            추천 상품
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            V.Medal로 굿즈를 구매하거나 V.Credit으로 전환할 수 있습니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {!products || products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center text-gray-500">
          등록된 상품이 없습니다.
        </div>
      ) : (
        <ShopProductList products={products} currentMedals={user.current_medals ?? 0} />
      )}
    </div>
  )
}
