'use client'

import type { AuctionBidAdminRow, AuctionItemRow } from '@/api/actions/admin/auction'

const categoryLabel: Record<string, string> = { LAPTOP: '노트북', MONITOR: '모니터', ETC: '기타' }

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function AuctionBidsTable({
  eventTitle,
  isClosed,
  items,
  bids,
}: {
  eventTitle: string
  isClosed: boolean
  items: AuctionItemRow[]
  bids: AuctionBidAdminRow[]
}) {
  const winners = items.filter((i) => i.current_highest_bid != null)

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">품목별 최고가 {isClosed && '(마감)'}</h3>
            <p className="text-xs text-gray-500">{isClosed ? '경매가 마감되어 아래가 최종 낙찰 현황입니다.' : '경매 진행 중 실시간 최고가입니다.'}</p>
          </div>
          <button
            type="button"
            disabled={winners.length === 0}
            onClick={() =>
              downloadCsv(
                `${eventTitle}-낙찰현황.csv`,
                [
                  ['품목', '분류', '시작가', '최고가', '낙찰자'],
                  ...winners.map((i) => [
                    i.name,
                    categoryLabel[i.category] ?? i.category,
                    String(i.starting_price),
                    String(i.current_highest_bid ?? ''),
                    i.current_highest_bidder_name ?? '',
                  ]),
                ]
              )
            }
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            CSV 다운로드
          </button>
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            등록된 품목이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3">품목</th>
                  <th className="px-4 py-3">분류</th>
                  <th className="px-4 py-3 text-right">시작가</th>
                  <th className="px-4 py-3 text-right">최고가</th>
                  <th className="px-4 py-3">{isClosed ? '낙찰자' : '현재 최고 입찰자'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((i) => (
                  <tr key={i.item_id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{i.name}</td>
                    <td className="px-4 py-3">{categoryLabel[i.category] ?? i.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{i.starting_price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                      {i.current_highest_bid != null ? i.current_highest_bid.toLocaleString() : '입찰 없음'}
                    </td>
                    <td className="px-4 py-3">{i.current_highest_bidder_name ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">전체 입찰 기록</h3>
            <p className="text-xs text-gray-500">최신 제출순 · 총 {bids.length.toLocaleString()}건</p>
          </div>
          <button
            type="button"
            disabled={bids.length === 0}
            onClick={() =>
              downloadCsv(
                `${eventTitle}-입찰기록.csv`,
                [
                  ['제출일시', '품목', '이름', '이메일', '부서', '입찰가'],
                  ...bids.map((b) => [
                    new Date(b.created_at).toLocaleString('ko-KR'),
                    b.item_name,
                    b.user_name ?? '',
                    b.user_email ?? '',
                    b.dept_name ?? '',
                    String(b.bid_amount),
                  ]),
                ]
              )
            }
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            CSV 다운로드
          </button>
        </div>
        {bids.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            제출된 입찰이 없습니다.
          </div>
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3">제출일시</th>
                  <th className="px-4 py-3">품목</th>
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">부서</th>
                  <th className="px-4 py-3 text-right">입찰가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bids.map((b) => (
                  <tr key={b.bid_id}>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{new Date(b.created_at).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-3">{b.item_name}</td>
                    <td className="px-4 py-3">{b.user_name || b.user_email || b.user_id}</td>
                    <td className="px-4 py-3">{b.dept_name ?? '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{b.bid_amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
