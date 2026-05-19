'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { revertAdminGrantTransaction } from '@/api/actions/admin'
import { Undo2 } from 'lucide-react'

type Props = {
  transactionId: string
  /** 직원 이름 등 — 확인창에만 표시 */
  label: string
}

/** 관리자 수동 지급(ADMIN_GRANT 적립) 한 건 취소 */
export function RevertAdminGrantButton({ transactionId, label }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function run() {
    const ok = window.confirm(
      `「${label}」관리자 지급 건을 취소할까요?\n\n직원 잔액에서 차감하고, 이 거래는 목록에서 숨깁니다. (크레딧은 해당 로트가 아직 전부 남아 있을 때만 가능합니다.)`
    )
    if (!ok) return
    setMsg(null)
    startTransition(async () => {
      const res = await revertAdminGrantTransaction(transactionId)
      if (res.error) {
        setMsg(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
      >
        <Undo2 className="size-3.5 shrink-0" aria-hidden />
        {pending ? '처리…' : '지급 취소'}
      </button>
      {msg && <span className="max-w-[140px] text-right text-[11px] text-red-600">{msg}</span>}
    </div>
  )
}
