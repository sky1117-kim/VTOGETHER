'use client'

import type { AuctionBidAdminRow, AuctionItemRow } from '@/api/actions/admin/auction'
import { computeAuctionFinalWinners } from '@/lib/auction-final-results'

const categoryLabel: Record<string, string> = { LAPTOP: '노트북', MONITOR: '모니터', ETC: '기타' }

type FinalResultRow = {
  item: AuctionItemRow
  winner: { name: string; amount: number } | null
  note: '유찰' | '단독입찰' | '조정됨' | null
}

/** 1인 1대 원칙이 적용된 최종 낙찰 결과를 이름까지 붙여 반환한다 (관리자 표 표시용). */
function computeFinalResults(items: AuctionItemRow[], bids: AuctionBidAdminRow[]): FinalResultRow[] {
  const nameByUserId = new Map<string, string>()
  for (const b of bids) nameByUserId.set(b.user_id, b.user_name || b.user_email || b.user_id)

  const currentHighestBidderByItem = new Map(items.map((i) => [i.item_id, i.current_highest_bidder_id]))
  const winners = computeAuctionFinalWinners(
    items.map((i) => i.item_id),
    bids.map((b) => ({ item_id: b.item_id, user_id: b.user_id, bid_amount: b.bid_amount })),
    currentHighestBidderByItem
  )

  return items.map((item) => {
    const w = winners.get(item.item_id)
    if (!w) return { item, winner: null, note: '유찰' }
    return { item, winner: { name: nameByUserId.get(w.user_id) ?? w.user_id, amount: w.amount }, note: w.note }
  })
}

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
  const finalResults = computeFinalResults(items, bids)
  const adjustedCount = finalResults.filter((r) => r.note === '조정됨').length
  const unsoldCount = finalResults.filter((r) => r.note === '유찰').length

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">최종 낙찰 결과 · 1인 1대 자동 적용</h3>
            <p className="text-xs text-gray-600">
              {isClosed ? '마감 시점 입찰 기록 기준입니다.' : '진행 중인 입찰 기준 실시간 계산이라 마감 전까지 계속 바뀔 수 있습니다.'}
              {' '}한 사람이 여러 품목 최고가를 쥐고 있으면 가장 높은 금액 품목만 자동으로 남기고 나머지는 차순위에게 재배정합니다(본인 외 입찰자가 없는 품목은 예외). 사용자 화면의 낙찰자·낙찰가도 이 결과와 동일하게 표시됩니다. 실제 급여공제·물품 전달은 운영팀이 수동으로 진행합니다.
            </p>
          </div>
          <button
            type="button"
            disabled={finalResults.length === 0}
            onClick={() =>
              downloadCsv(
                `${eventTitle}-최종낙찰결과.csv`,
                [
                  ['품목', '분류', '시작가', '낙찰가', '낙찰자', '비고'],
                  ...finalResults.map((r) => [
                    r.item.name,
                    categoryLabel[r.item.category] ?? r.item.category,
                    String(r.item.starting_price),
                    r.winner ? String(r.winner.amount) : '',
                    r.winner ? r.winner.name : '',
                    r.note ?? '',
                  ]),
                ]
              )
            }
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
          >
            CSV 다운로드
          </button>
        </div>
        {(adjustedCount > 0 || unsoldCount > 0) && (
          <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
            {adjustedCount > 0 && (
              <span className="rounded-full bg-amber-200 px-2.5 py-1 text-amber-900">1인 1대 적용으로 조정된 품목 {adjustedCount}건</span>
            )}
            {unsoldCount > 0 && (
              <span className="rounded-full bg-gray-200 px-2.5 py-1 text-gray-700">유찰 {unsoldCount}건</span>
            )}
          </div>
        )}
        {finalResults.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
            등록된 품목이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3">품목</th>
                  <th className="px-4 py-3">분류</th>
                  <th className="px-4 py-3 text-right">낙찰가</th>
                  <th className="px-4 py-3">낙찰자</th>
                  <th className="px-4 py-3">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {finalResults.map((r) => (
                  <tr key={r.item.item_id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.item.name}</td>
                    <td className="px-4 py-3">{categoryLabel[r.item.category] ?? r.item.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                      {r.winner ? r.winner.amount.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">{r.winner ? r.winner.name : '-'}</td>
                    <td className="px-4 py-3">
                      {r.note === '조정됨' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">조정됨</span>
                      )}
                      {r.note === '단독입찰' && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">단독입찰</span>
                      )}
                      {r.note === '유찰' && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">유찰</span>
                      )}
                    </td>
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
            <h3 className="text-base font-semibold text-gray-900">품목별 최고 입찰가 (1인 1대 적용 전 원본)</h3>
            <p className="text-xs text-gray-500">1인 1대 재배정 전, 품목별 순수 최고 입찰 기록입니다. 최종 결과는 위 표를 참고하세요.</p>
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
                  <th className="px-4 py-3">최고 입찰자</th>
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
                    new Date(b.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
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
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{new Date(b.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
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
