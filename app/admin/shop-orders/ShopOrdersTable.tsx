'use client'

import { useState, useTransition } from 'react'
import type { ShopOrderAdminRow } from '@/api/actions/admin/shop-orders'
import { cancelShopOrder, setShopOrderFulfillment } from '@/api/actions/admin/shop-orders'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { AlertModal } from '@/components/ui/AlertModal'

function productTypeLabel(t: string): string {
  const k = t.toUpperCase()
  if (k === 'GOODS') return '실물 굿즈'
  if (k === 'CREDIT_PACK') return 'V.Credit 전환'
  if (k === 'ALMAENG_STORE') return '알맹 스토어'
  return t
}

interface ShopOrdersTableProps {
  rows: ShopOrderAdminRow[]
}

export function ShopOrdersTable({ rows }: ShopOrdersTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [cancelTarget, setCancelTarget] = useState<ShopOrderAdminRow | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const handleToggle = (orderId: string, checked: boolean) => {
    startTransition(async () => {
      const result = await setShopOrderFulfillment(orderId, checked)
      if (result.success) router.refresh()
      else if (result.error) alert(result.error)
    })
  }

  const handleConfirmCancel = () => {
    if (!cancelTarget) return
    const orderId = cancelTarget.order_id
    setCancelTarget(null)
    startTransition(async () => {
      const result = await cancelShopOrder(orderId)
      if (result.success) router.refresh()
      else setAlertMessage(result.error ?? '주문 취소에 실패했습니다.')
    })
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-[860px] w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-3">지급 체크</th>
            <th className="whitespace-nowrap px-3 py-3">일시</th>
            <th className="px-3 py-3">구매자</th>
            <th className="px-3 py-3">상품</th>
            <th className="whitespace-nowrap px-3 py-3">유형</th>
            <th className="whitespace-nowrap px-3 py-3">상태</th>
            <th className="whitespace-nowrap px-3 py-3 text-right">메달</th>
            <th className="whitespace-nowrap px-3 py-3 text-right">적립 C</th>
            <th className="whitespace-nowrap px-3 py-3">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                주문 내역이 없습니다.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const needsFulfillment = row.product_type === 'GOODS' || row.product_type === 'ALMAENG_STORE'
            const fulfilled = !!row.fulfilled_at
            const cancelled = row.status === 'CANCELLED'
            const canCancel = needsFulfillment && !cancelled && !fulfilled
            return (
              <tr key={row.order_id} className={`hover:bg-green-50/30 ${cancelled ? 'opacity-60' : ''}`}>
                <td className="whitespace-nowrap px-3 py-2">
                  {cancelled ? (
                    <span className="text-xs text-gray-400">취소됨</span>
                  ) : needsFulfillment ? (
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={fulfilled}
                        disabled={isPending}
                        onChange={(e) => handleToggle(row.order_id, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                      />
                      <span className={`text-xs ${fulfilled ? 'text-green-700' : 'text-gray-500'}`}>
                        {fulfilled ? '지급 완료' : '지급 필요'}
                      </span>
                    </label>
                  ) : (
                    <span className="text-xs text-gray-400">자동 적립</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                  {new Date(row.created_at).toLocaleString('ko-KR')}
                </td>
                <td className="px-3 py-2 text-gray-900">
                  <div className="font-medium">{row.user_name?.trim() || '이름 없음'}</div>
                  <div className="max-w-[200px] truncate text-xs text-gray-500">{row.user_email?.trim() || row.user_id}</div>
                  {row.dept_name?.trim() ? <div className="text-xs text-gray-400">{row.dept_name.trim()}</div> : null}
                </td>
                <td className="px-3 py-2 text-gray-800">
                  <span className="font-medium">{row.product_snapshot_name}</span>
                  {(row.variant_color || row.variant_size) && (
                    <div className="mt-0.5 text-xs font-semibold text-emerald-700">
                      {[row.variant_color, row.variant_size].filter(Boolean).join(' / ')}
                    </div>
                  )}
                  <div className="mt-0.5 font-mono text-[10px] text-gray-400">{row.product_id.slice(0, 8)}…</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700">{productTypeLabel(row.product_type)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      cancelled ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {cancelled ? '취소됨' : '완료'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-700">
                  −{row.payment_medal.toLocaleString()} M
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-700">
                  {row.credit_granted > 0 ? `+${row.credit_granted.toLocaleString()} C` : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {canCancel ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setCancelTarget(row)}
                      className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      요청 취소
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <ConfirmModal
        isOpen={!!cancelTarget}
        title="상품 요청 취소"
        message={
          cancelTarget
            ? `"${cancelTarget.product_snapshot_name}" 요청을 취소하시겠습니까?\n${cancelTarget.payment_medal.toLocaleString()} Medal이 환불되고 재고가 복구됩니다.`
            : ''
        }
        confirmLabel="취소하기"
        cancelLabel="닫기"
        variant="danger"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
      <AlertModal
        isOpen={!!alertMessage}
        title="취소 실패"
        message={alertMessage ?? ''}
        variant="error"
        onClose={() => setAlertMessage(null)}
      />
    </div>
  )
}
