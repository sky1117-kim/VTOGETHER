'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runHealthChallengeMonthlySettlement } from '@/api/actions/admin/health-challenges'

export function SettlementForm({
  seasons,
}: {
  seasons: { season_id: string; name: string; slug: string; status: string }[]
}) {
  const router = useRouter()
  const [seasonId, setSeasonId] = useState(seasons[0]?.season_id ?? '')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!seasonId) {
      setMsg({ type: 'err', text: '시즌을 선택하세요.' })
      return
    }
    setPending(true)
    setMsg(null)
    const r = await runHealthChallengeMonthlySettlement(seasonId, year, month)
    setPending(false)
    if (!r.success) {
      setMsg({ type: 'err', text: r.error ?? '정산 실패' })
      return
    }
    setMsg({ type: 'ok', text: `정산 완료: ${r.paidUsers}명에게 V.Medal을 지급했습니다.` })
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">월말 정산 (V.Medal)</h2>
      <p className="text-sm text-gray-600">
        선택한 연·월의 종목별 달성 레벨을 합산해, 레벨 1당 1M 지급합니다. (최대 12M) 이미 정산된 사용자는 건너뜁니다.
      </p>
      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-gray-500">시즌</label>
          <select
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {seasons.map((s) => (
              <option key={s.season_id} value={s.season_id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">연도</label>
          <input
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">월</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending || !seasons.length}
        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? '처리 중…' : '정산 실행'}
      </button>
    </form>
  )
}
