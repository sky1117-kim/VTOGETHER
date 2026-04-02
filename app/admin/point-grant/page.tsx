import Link from 'next/link'
import { getUsersForAdmin, getPointTransactionsForAdmin } from '@/api/actions/admin'
import { getEarnedDisplay } from '@/lib/point-display'
import { GrantPointsForm } from '../components/GrantPointsForm'
import { AdminPageHeader } from '../components/AdminPageHeader'

type TxType = 'ALL' | 'EARNED' | 'DONATED' | 'USED'
type CurrencyType = 'ALL' | 'V_CREDIT' | 'V_MEDAL'

function getRelatedTypeBadgeLabel(relatedType: string | null): string {
  const key = (relatedType ?? '').trim().toUpperCase()
  const map: Record<string, string> = {
    SHOP_PURCHASE: 'SHOP',
    ADMIN_GRANT: 'ADMIN',
    DONATION: 'DONATE',
    EVENT: 'EVENT',
    TRANSFER: 'TRANSFER',
    MANUAL: 'MANUAL',
  }
  if (!key) return '—'
  return map[key] ?? key.replaceAll('_', ' ')
}

function getCompactDescription(row: {
  type: 'EARNED' | 'DONATED' | 'USED'
  related_type: string | null
  description: string | null
  donation_target_name: string | null
}): string {
  const raw = row.description?.trim() ?? ''
  const relatedType = (row.related_type ?? '').trim().toUpperCase()

  if (row.type === 'DONATED' && row.donation_target_name) return `${row.donation_target_name} 기부`
  if (!raw && !row.donation_target_name) return '—'

  if (relatedType === 'EVENT' && row.type === 'EARNED') {
    return getEarnedDisplay(raw, { maxTextLength: 22 }).text
  }
  if (relatedType === 'HEALTH_CHALLENGE_SETTLEMENT') return '건강 챌린지 정산'
  if (relatedType === 'ADMIN_GRANT') return '관리자 지급'
  return raw || row.donation_target_name || '—'
}

/** 관리자 전용: 수동 지급 + 지급/적립/사용 내역을 한 화면에서 관리 */
export default async function AdminPointGrantPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    txType?: string
    currencyType?: string
    relatedType?: string
    from?: string
    to?: string
    page?: string
  }>
}) {
  // URL 쿼리를 읽어 서버에서 바로 필터링된 거래 목록을 조회합니다.
  const params = await searchParams
  const txType: TxType = params.txType === 'EARNED' || params.txType === 'DONATED' || params.txType === 'USED' ? params.txType : 'ALL'
  const currencyType: CurrencyType = params.currencyType === 'V_CREDIT' || params.currencyType === 'V_MEDAL' ? params.currencyType : 'ALL'
  const page = Number(params.page ?? '1')
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1

  const [{ data: users, error: usersError }, txResult] = await Promise.all([
    getUsersForAdmin(),
    getPointTransactionsForAdmin({
      q: params.q ?? '',
      txType,
      currencyType,
      relatedType: params.relatedType ?? '',
      from: params.from ?? '',
      to: params.to ?? '',
      page: safePage,
      pageSize: 30,
    }),
  ])
  const userList = users ?? []
  const rows = txResult.data ?? []
  const totalPages = Math.max(1, Math.ceil(txResult.total / txResult.pageSize))

  // 페이지 이동 시 현재 필터를 유지하기 위한 쿼리 문자열 생성 함수입니다.
  const queryOf = (nextPage: number) => {
    const query = new URLSearchParams()
    if (params.q?.trim()) query.set('q', params.q.trim())
    if (txType !== 'ALL') query.set('txType', txType)
    if (currencyType !== 'ALL') query.set('currencyType', currencyType)
    if (params.relatedType?.trim()) query.set('relatedType', params.relatedType.trim())
    if (params.from?.trim()) query.set('from', params.from.trim())
    if (params.to?.trim()) query.set('to', params.to.trim())
    query.set('page', String(nextPage))
    return query.toString()
  }

  const txTypeLabel: Record<TxType, string> = {
    ALL: '전체',
    EARNED: '적립',
    DONATED: '기부',
    USED: '사용',
  }
  const currencyTypeLabel: Record<CurrencyType, string> = {
    ALL: '전체',
    V_CREDIT: 'V.Credit',
    V_MEDAL: 'V.Medal',
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="지급 / 적립 내역"
        description="수동 지급과 직원 거래 내역 조회를 한 화면에서 처리합니다. 검색·필터로 적립/기부/사용 흐름을 바로 확인할 수 있습니다."
        breadcrumbs={[
          { label: '관리자', href: '/admin' },
          { label: '지급/적립 내역' },
        ]}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">V.Credit 수동 지급</h2>
            <p className="mt-1 text-sm text-gray-500">보정/특별 보상 지급 전용 영역</p>
          </div>
        </div>
        <p className="rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
          <strong>팁:</strong> 사유란에 &quot;○○ 이벤트 누락 보정&quot;처럼 적어 두면 나중에 엑셀·감사 때 구분하기 쉽습니다. 비우면「관리자 지급」으로만 기록됩니다.
        </p>
        {usersError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            사용자 목록 조회 실패: {usersError}
          </div>
        )}
        <GrantPointsForm users={userList} />
        {userList.length === 0 && !usersError && (
          <p className="mt-4 text-sm text-amber-700">
            사용자가 없습니다. 한 명이라도 메인에서 로그인한 뒤 다시 열어주세요.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">직원 지급/적립/사용 내역 조회</h2>
            <p className="mt-1 text-sm text-gray-500">필터를 걸어 거래 흐름을 빠르게 점검하세요.</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
            총 {txResult.total.toLocaleString()}건
          </div>
        </div>
        <form className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 md:grid-cols-2 lg:grid-cols-4" method="get">
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="이름, 이메일, 사유 검색"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select
            name="txType"
            defaultValue={txType}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="ALL">거래 유형: 전체</option>
            <option value="EARNED">거래 유형: 적립</option>
            <option value="DONATED">거래 유형: 기부</option>
            <option value="USED">거래 유형: 사용</option>
          </select>
          <select
            name="currencyType"
            defaultValue={currencyType}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="ALL">재화: 전체</option>
            <option value="V_CREDIT">재화: V.Credit</option>
            <option value="V_MEDAL">재화: V.Medal</option>
          </select>
          <input
            type="text"
            name="relatedType"
            defaultValue={params.relatedType ?? ''}
            placeholder="출처코드 (예: EVENT, ADMIN_GRANT)"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ''}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ''}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-2 lg:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              필터 적용
            </button>
            <Link
              href="/admin/point-grant"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </Link>
          </div>
        </form>

        {(usersError || txResult.error) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {usersError && <p>사용자 목록 조회 실패: {usersError}</p>}
            {txResult.error && <p>거래 내역 조회 실패: {txResult.error}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">거래유형: {txTypeLabel[txType]}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">재화: {currencyTypeLabel[currencyType]}</span>
          {params.relatedType?.trim() && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              출처: {params.relatedType.trim()}
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">일시</th>
                <th className="px-3 py-2 text-left font-semibold">직원</th>
                <th className="px-3 py-2 text-left font-semibold">유형</th>
                <th className="px-3 py-2 text-left font-semibold">재화</th>
                <th className="px-3 py-2 text-right font-semibold">금액</th>
                <th className="px-3 py-2 text-left font-semibold">출처</th>
                <th className="px-3 py-2 text-left font-semibold">사유/설명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    조건에 맞는 거래 내역이 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.transaction_id} className="hover:bg-green-50/30">
                  <td className="whitespace-nowrap px-2 py-2 text-gray-700">
                    {new Date(row.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    <div className="truncate font-medium">{row.user_name || '이름 없음'}</div>
                    <div className="max-w-[160px] truncate text-xs text-gray-500">{row.user_email || row.user_id}</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {row.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">{row.currency_type === 'V_CREDIT' ? 'V.Credit' : 'V.Medal'}</td>
                  <td className={`whitespace-nowrap px-2 py-2 text-right font-semibold ${row.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.amount >= 0 ? '+' : ''}
                    {row.amount.toLocaleString()}
                    {row.currency_type === 'V_CREDIT' ? ' C' : ' M'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-gray-700">
                    <span className="inline-block max-w-full truncate rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                      {getRelatedTypeBadgeLabel(row.related_type)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-pre-wrap break-words leading-6 align-top">
                    {getCompactDescription(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-sm text-gray-600">
            페이지 {txResult.page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              href={`/admin/point-grant?${queryOf(Math.max(1, txResult.page - 1))}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${txResult.page <= 1 ? 'pointer-events-none border-gray-200 text-gray-300' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              이전
            </Link>
            <Link
              href={`/admin/point-grant?${queryOf(Math.min(totalPages, txResult.page + 1))}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${txResult.page >= totalPages ? 'pointer-events-none border-gray-200 text-gray-300' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              다음
            </Link>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500">
        <Link
          href="/admin"
          className="font-medium text-green-600 hover:text-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded"
        >
          ← 대시보드로
        </Link>
      </p>
    </div>
  )
}
