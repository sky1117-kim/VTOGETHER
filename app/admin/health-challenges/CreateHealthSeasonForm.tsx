'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createHealthSeason } from '@/api/actions/admin/health-challenges'
function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20'

export function CreateHealthSeasonForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`)
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>('ACTIVE')
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setPending(true)
    const r = await createHealthSeason({
      name,
      slug: slug.trim(),
      startDate,
      endDate,
      status,
    })
    setPending(false)
    if (!r.success) {
      setMsg({ type: 'err', text: r.error ?? '실패' })
      return
    }
    setMsg({ type: 'ok', text: '시즌을 만들었습니다. 종목 4개·레벨 목표가 자동으로 들어갑니다.' })
    setName('')
    setSlug('')
    router.refresh()
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-6 shadow-sm"
    >
      <h2 className="text-base font-semibold text-gray-900">새 시즌 열기</h2>
      <p className="text-sm text-gray-600">
        일반 이벤트 등록(/admin/events)과 같이 운영하는 별도 프로그램입니다. 시즌을 저장하면 걷기·러닝·하이킹·라이딩 종목과 L1~L3 목표가 자동 생성됩니다.
      </p>
      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.type === 'ok' ? 'bg-green-100 text-green-900' : 'bg-red-50 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">시즌 이름 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 2026 건강 챌린지"
            required
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">슬러그 (선택, 영문 소문자·숫자·하이픈)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="비우면 서버가 hc-날짜-랜덤으로 자동 생성"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">시작일 *</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={endDate}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">종료일 *</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">생성 직후 상태</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ACTIVE')}
            className={inputClass}
          >
            <option value="ACTIVE">ACTIVE — 메인 노출·참여 가능 (다른 ACTIVE 시즌은 보관)</option>
            <option value="DRAFT">DRAFT — 준비만 (메인 미노출)</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? '저장 중…' : '시즌 만들기'}
      </button>
      <p className="text-xs text-gray-500">챌린지 기간은 활동일 검증에 쓰입니다. 오늘(서울) 기준: {todayYmd()}</p>
    </form>
  )
}
