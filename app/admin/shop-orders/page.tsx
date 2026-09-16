import Link from 'next/link'
import { AdminPageHeader } from '../components/AdminPageHeader'
import {
  getShopOrdersForAdmin,
  getShopOrderDeptOptions,
  type ShopOrderFulfillmentFilter,
  type ShopOrderKindFilter,
} from '@/api/actions/admin/shop-orders'
import { ShopOrdersTable } from './ShopOrdersTable'

const fulfillmentLabel: Record<ShopOrderFulfillmentFilter, string> = {
  ALL: '전체',
  NEEDED: '지급 필요',
  DONE: '지급 완료',
  CANCELLED: '취소됨',
}

/** 관리자: 상점 주문 — 누가 어떤 상품을 샀는지(실물 지급용) */
export default async function AdminShopOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; fulfillment?: string; dept?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const kind: ShopOrderKindFilter =
    params.kind === 'PHYSICAL' || params.kind === 'CREDIT_PACK' ? params.kind : 'ALL'
  const fulfillment: ShopOrderFulfillmentFilter =
    params.fulfillment === 'NEEDED' || params.fulfillment === 'DONE' || params.fulfillment === 'CANCELLED'
      ? params.fulfillment
      : 'ALL'
  const dept = (params.dept ?? '').trim()
  const page = Number(params.page ?? '1')
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const q = params.q ?? ''

  const [result, deptOptions] = await Promise.all([
    getShopOrdersForAdmin({
      kind,
      fulfillment,
      dept,
      q,
      page: safePage,
      pageSize: 40,
    }),
    getShopOrderDeptOptions(),
  ])

  const rows = result.data ?? []
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  const queryOf = (next: {
    kind?: ShopOrderKindFilter
    fulfillment?: ShopOrderFulfillmentFilter
    dept?: string
    page?: number
    q?: string
  }) => {
    const sp = new URLSearchParams()
    const k = next.kind ?? kind
    if (k !== 'ALL') sp.set('kind', k)
    const f = next.fulfillment ?? fulfillment
    if (f !== 'ALL') sp.set('fulfillment', f)
    const d = next.dept !== undefined ? next.dept : dept
    if (d.trim()) sp.set('dept', d.trim())
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

  const activeFilterChips: string[] = []
  if (kind !== 'ALL') activeFilterChips.push(kind === 'PHYSICAL' ? '실물·ESG' : '크레딧팩')
  if (fulfillment !== 'ALL') activeFilterChips.push(fulfillmentLabel[fulfillment])
  if (dept) activeFilterChips.push(dept)
  if (q.trim()) activeFilterChips.push(`검색: ${q.trim()}`)

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="상점 주문 내역"
        description="누가 어떤 상품을 구매했는지 확인하고, 실물 굿즈·ESG 상품은 지급 처리에 활용하세요. V.Credit 전환 상품은 결제 시 자동 적립됩니다. 지급 전 실물·ESG 요청은 취소할 수 있습니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '상점 주문' }]}
      />

      {result.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</div>
      )}

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tab('ALL', '전체')}
          {tab('PHYSICAL', '실물·ESG (지급 필요)')}
          {tab('CREDIT_PACK', '크레딧팩 (자동 적립)')}
        </div>

        <form
          method="get"
          className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          {kind !== 'ALL' ? <input type="hidden" name="kind" value={kind} /> : null}

          <select
            name="fulfillment"
            defaultValue={fulfillment}
            className="min-h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700"
            aria-label="지급 상태로 필터"
          >
            <option value="ALL">지급상태: 전체</option>
            <option value="NEEDED">지급 필요</option>
            <option value="DONE">지급 완료</option>
            <option value="CANCELLED">취소됨</option>
          </select>

          <select
            name="dept"
            defaultValue={dept}
            className="min-h-10 min-w-0 max-w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-700 sm:max-w-[180px]"
            aria-label="부서로 필터"
          >
            <option value="">부서: 전체</option>
            {deptOptions.data.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <input
            name="q"
            defaultValue={q}
            placeholder="이름·이메일·상품명 검색"
            className="min-h-10 w-full min-w-0 rounded-lg border border-gray-200 px-3 text-sm sm:w-56"
          />

          <button
            type="submit"
            className="min-h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
          >
            필터 적용
          </button>

          {activeFilterChips.length > 0 && (
            <Link
              href="/admin/shop-orders"
              className="min-h-10 inline-flex items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              초기화
            </Link>
          )}
        </form>

        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {activeFilterChips.map((c) => (
              <span key={c} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {c}
              </span>
            ))}
            <span className="text-xs text-gray-400">· 총 {result.total.toLocaleString()}건</span>
          </div>
        )}
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
