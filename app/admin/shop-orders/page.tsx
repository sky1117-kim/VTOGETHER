import Link from 'next/link'
import { AdminPageHeader } from '../components/AdminPageHeader'
import {
  getShopOrdersForAdmin,
  type ShopOrderKindFilter,
} from '@/api/actions/admin/shop-orders'
import { ShopOrdersTable } from './ShopOrdersTable'

/** 관리자: 상점 주문 — 누가 어떤 상품을 샀는지(실물 지급용) */
export default async function AdminShopOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const kind: ShopOrderKindFilter =
    params.kind === 'PHYSICAL' || params.kind === 'CREDIT_PACK' ? params.kind : 'ALL'
  const page = Number(params.page ?? '1')
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const q = params.q ?? ''

  const result = await getShopOrdersForAdmin({
    kind,
    q,
    page: safePage,
    pageSize: 40,
  })

  const rows = result.data ?? []
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  const queryOf = (next: { kind?: ShopOrderKindFilter; page?: number; q?: string }) => {
    const sp = new URLSearchParams()
    const k = next.kind ?? kind
    if (k !== 'ALL') sp.set('kind', k)
    const qq = next.q !== undefined ? next.q : q
    if (qq.trim()) sp.set('q', qq.trim())
    sp.set('page', String(next.page ?? safePage))
    return sp.toString()
  }

  const tab = (k: ShopOrderKindFilter, label: string) => {
    const active = kind === k
    const href = `/admin/shop-orders?${queryOf({ kind: k, page: 1 })}`
    return (
      <Link
        href={href}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          active ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="상점 주문 내역"
        description="누가 어떤 상품을 구매했는지 확인하고, 실물 굿즈·알맹 스토어 상품은 지급 처리에 활용하세요. V.Credit 전환 상품은 결제 시 자동 적립됩니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '상점 주문' }]}
      />

      {result.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tab('ALL', '전체')}
          {tab('PHYSICAL', '실물·알맹 (지급 필요)')}
          {tab('CREDIT_PACK', '크레딧팩 (자동 적립)')}
        </div>
        <form method="get" className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {kind !== 'ALL' ? <input type="hidden" name="kind" value={kind} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="이름·이메일·상품명 검색"
            className="min-h-10 w-full min-w-0 rounded-lg border border-gray-200 px-3 text-sm sm:w-64"
          />
          <button
            type="submit"
            className="min-h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
          >
            검색
          </button>
        </form>
      </div>

      <ShopOrdersTable rows={rows} />

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/shop-orders?${queryOf({ page: p })}`}
              className={`min-h-9 min-w-9 rounded-lg border px-2 py-1 text-center text-sm font-medium ${
                p === safePage
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        동일 상품을 여러 개 한 번에 구매하면 주문 행이 개수만큼 나뉘어 저장됩니다. 과거 거래에 이름이 비어 있으면 Supabase에서{' '}
        <code className="rounded bg-gray-100 px-1">docs/migrations/043-backfill-point-transactions-shop-user-display.sql</code>{' '}
        을 실행해 보세요.
      </p>
    </div>
  )
}
