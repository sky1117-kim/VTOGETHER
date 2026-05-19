'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { grantCurrencyBatchToUsers } from '@/api/actions/admin'
import type { UserRow } from '@/api/actions/admin'
import { AlertCircle, CheckCircle2, Coins, History, Medal, Search, Users, X } from 'lucide-react'
import { formatIntegerWithCommas, sanitizeIntegerInput } from '@/lib/number-format'

interface GrantPointsFormProps {
  users: UserRow[]
}

const RECENT_STORAGE_KEY = 'vtogether.adminGrantRecentUserIds'

function normalize(s: string) {
  return s.toLowerCase().replace(/\s/g, '')
}

type GrantCurrency = 'V_CREDIT' | 'V_MEDAL'

function readRecentUserIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(RECENT_STORAGE_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

function pushRecentUserIds(ids: string[]) {
  if (typeof window === 'undefined') return
  const cur = readRecentUserIds()
  const next = [...ids, ...cur.filter((id) => !ids.includes(id))].slice(0, 8)
  window.sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next))
}

const REASON_QUICK = ['이벤트 누락 보정', '특별 보상', '테스트 지급', '건강 챌린지 보정']

export function GrantPointsForm({ users }: GrantPointsFormProps) {
  const initial = users[0] ?? null
  const [picked, setPicked] = useState<string[]>(() => (initial ? [initial.user_id] : []))
  const [search, setSearch] = useState('')
  const [currency, setCurrency] = useState<GrantCurrency>('V_CREDIT')
  const [amount, setAmount] = useState('1000')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const amountInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setRecentIds(readRecentUserIds())
  }, [])

  useEffect(() => {
    if (users.length === 0) {
      setPicked([])
      return
    }
    setPicked((prev) => {
      const valid = prev.filter((id) => users.some((u) => u.user_id === id))
      if (valid.length > 0) return valid
      return [users[0].user_id]
    })
  }, [users])

  const pickedSet = useMemo(() => new Set(picked), [picked])

  const pickedUsers = useMemo(() => {
    return picked.map((id) => users.find((u) => u.user_id === id)).filter((u): u is UserRow => !!u)
  }, [picked, users])

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'ko'))
  }, [users])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return sortedUsers.slice(0, 80)
    const q = normalize(search.trim())
    return sortedUsers.filter(
      (u) =>
        normalize(u.name ?? '').includes(q) ||
        normalize(u.email ?? '').includes(q) ||
        (u.dept_name && normalize(u.dept_name).includes(q))
    )
  }, [sortedUsers, search])

  const recentUsers = useMemo(() => {
    return recentIds.map((id) => users.find((u) => u.user_id === id)).filter((u): u is UserRow => !!u)
  }, [recentIds, users])

  const parsedAmount = useMemo(() => {
    const n = parseInt(sanitizeIntegerInput(amount), 10)
    if (!Number.isFinite(n) || n < 1) return null
    return n
  }, [amount])

  const toggle = useCallback((userId: string) => {
    setPicked((prev) => (prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]))
  }, [])

  const selectFilteredAll = useCallback(() => {
    const ids = filteredUsers.map((u) => u.user_id)
    setPicked((prev) => [...new Set([...prev, ...ids])])
  }, [filteredUsers])

  const clearFiltered = useCallback(() => {
    const drop = new Set(filteredUsers.map((u) => u.user_id))
    setPicked((prev) => prev.filter((id) => !drop.has(id)))
  }, [filteredUsers])

  const clearAll = useCallback(() => setPicked([]), [])

  function bumpAmount(delta: number) {
    const cur = parseInt(sanitizeIntegerInput(amount), 10)
    const base = Number.isFinite(cur) && cur >= 1 ? cur : 0
    setAmount(String(Math.max(1, base + delta)))
  }

  async function submitBatch() {
    setMessage(null)
    if (picked.length === 0) {
      setMessage({ type: 'error', text: '직원을 한 명 이상 선택해주세요.' })
      return
    }
    const num = parseInt(sanitizeIntegerInput(amount), 10)
    if (Number.isNaN(num) || num < 1) {
      setMessage({ type: 'error', text: '1 이상의 숫자를 입력해주세요.' })
      return
    }
    setPending(true)
    const res = await grantCurrencyBatchToUsers({
      userIds: picked,
      currency,
      amount: num,
      reason: reason.trim() || undefined,
    })
    setPending(false)
    const failedIdSet = new Set(res.failed.map((f) => f.userId))
    const okIds = picked.filter((id) => !failedIdSet.has(id))
    if (okIds.length > 0) {
      pushRecentUserIds(okIds)
      setRecentIds(readRecentUserIds())
    }
    if (res.grantedCount === 0) {
      setMessage({ type: 'error', text: res.error || '지급에 실패했습니다.' })
      return
    }
    const unit = currency === 'V_CREDIT' ? 'C' : 'M'
    if (res.failed.length > 0) {
      setMessage({
        type: 'warn',
        text: `${res.grantedCount}명 지급 완료 (${num.toLocaleString()}${unit}씩). 실패 ${res.failed.length}명 — ${res.error || ''}`,
      })
    } else {
      setMessage({
        type: 'ok',
        text: `${res.grantedCount}명에게 각 ${num.toLocaleString()}${unit} 지급했습니다.`,
      })
    }
    setAmount(currency === 'V_CREDIT' ? '1000' : '1')
    setReason('')
    amountInputRef.current?.focus()
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        사용자가 없습니다. 로그인 후 다시 열어주세요.
      </div>
    )
  }

  const creditPresets = [1000, 5000, 10000, 30000, 50000]
  const medalPresets = [1, 2, 3, 4, 5]
  const presets = currency === 'V_CREDIT' ? creditPresets : medalPresets
  const step = currency === 'V_CREDIT' ? 1000 : 1
  const unit = currency === 'V_CREDIT' ? 'C' : 'M'
  const totalGrant =
    parsedAmount != null && picked.length > 0 ? parsedAmount * picked.length : null

  const primaryLabel =
    parsedAmount != null && picked.length > 0
      ? `${picked.length}명 · 인당 ${parsedAmount.toLocaleString()}${unit}${
          totalGrant != null ? ` (합계 ${totalGrant.toLocaleString()}${unit})` : ''
        }`
      : `${picked.length}명 선택됨`

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm sm:p-5">
      {/* 상단 요약 — 한눈에 */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm">
            <Users className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">수동 지급</p>
            <p className="text-base font-bold tabular-nums text-gray-900">{primaryLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectFilteredAll}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
          >
            목록 전체 선택
          </button>
          <button
            type="button"
            onClick={clearFiltered}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
          >
            목록만 해제
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
          >
            전체 비우기
          </button>
        </div>
      </div>

      {recentUsers.length > 0 && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <History className="size-3.5 text-slate-500" aria-hidden />
            최근 지급한 직원 (이 브라우저)
          </p>
          <div className="flex flex-wrap gap-2">
            {recentUsers.map((u) => (
              <button
                key={u.user_id}
                type="button"
                onClick={() => toggle(u.user_id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  pickedSet.has(u.user_id)
                    ? 'border-green-600 bg-green-100 text-green-900 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-white'
                }`}
              >
                {u.name || u.email}
              </button>
            ))}
          </div>
        </div>
      )}

      {pickedUsers.length > 0 && (
        <div className="mb-4 max-h-28 overflow-y-auto rounded-lg border border-green-200/80 bg-green-50/40 p-2">
          <p className="mb-1.5 text-xs font-semibold text-green-900">선택된 직원 ({pickedUsers.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {pickedUsers.map((u) => (
              <span
                key={u.user_id}
                className="inline-flex max-w-[14rem] items-center gap-1 truncate rounded-lg border border-green-200 bg-white pl-2 pr-1 py-1 text-xs font-medium text-gray-900 shadow-sm"
              >
                <span className="truncate">{u.name || u.email}</span>
                <button
                  type="button"
                  onClick={() => toggle(u.user_id)}
                  className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  aria-label={`${u.name} 선택 해제`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        {/* 직원 목록 */}
        <div className="lg:col-span-6">
          <div className="mb-2 flex items-end justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900">직원 목록</h3>
            <span className="text-xs text-gray-500">
              {search.trim() ? `검색 결과 ${filteredUsers.length}명` : `처음 ${Math.min(80, filteredUsers.length)}명`}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 이메일, 부서 검색"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-900 placeholder:text-gray-400 shadow-inner focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
            {search.trim() !== '' && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="검색어 지우기"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600">
              <span className="w-8 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">이름 · 이메일</span>
              <span className="w-20 shrink-0 text-right tabular-nums">보유</span>
            </div>
            <div className="max-h-[min(320px,50vh)] overflow-y-auto bg-white">
              {filteredUsers.map((u) => {
                const on = pickedSet.has(u.user_id)
                return (
                  <label
                    key={u.user_id}
                    className={`flex cursor-pointer items-start gap-2 border-b border-gray-100 px-3 py-2.5 last:border-0 transition ${
                      on ? 'bg-green-50/90 ring-1 ring-inset ring-green-200/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={on}
                      onChange={() => toggle(u.user_id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-gray-900">{u.name || '이름 없음'}</div>
                      <div className="truncate text-xs text-gray-500">{u.email}</div>
                      {u.dept_name && (
                        <div className="truncate text-[11px] text-gray-400">{u.dept_name}</div>
                      )}
                    </div>
                    <div className="shrink-0 pt-0.5 text-right text-xs tabular-nums leading-tight text-gray-700">
                      <div>{u.current_points.toLocaleString()}C</div>
                      <div className="text-gray-400">{(u.current_medals ?? 0).toLocaleString()}M</div>
                    </div>
                  </label>
                )
              })}
              {filteredUsers.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>
              )}
            </div>
          </div>
        </div>

        {/* 금액 · 사유 · 실행 */}
        <div className="flex flex-col gap-3 lg:col-span-6">
          <h3 className="text-sm font-bold text-gray-900">금액 · 재화 · 사유</h3>

          <div className="flex rounded-xl border-2 border-gray-200 bg-gray-50 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setCurrency('V_CREDIT')
                setAmount('1000')
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${
                currency === 'V_CREDIT'
                  ? 'bg-white text-green-700 shadow-md ring-1 ring-green-600/20'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Coins className="size-4 text-amber-500" aria-hidden />
              V.Credit
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrency('V_MEDAL')
                setAmount('1')
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${
                currency === 'V_MEDAL'
                  ? 'bg-white text-violet-800 shadow-md ring-1 ring-violet-600/25'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Medal className="size-4 text-violet-500" aria-hidden />
              V.Medal
            </button>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold text-gray-600">빠른 금액</p>
              <p className="text-[11px] text-gray-400">
                {currency === 'V_CREDIT' ? '자주 쓰는 C 단위' : '1~5 M 한 번에 선택'}
              </p>
            </div>
            <div
              className={
                currency === 'V_MEDAL'
                  ? 'grid grid-cols-5 gap-2'
                  : 'flex flex-wrap gap-2'
              }
            >
              {presets.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(String(n))}
                  className={`rounded-lg border-2 py-2.5 text-sm font-semibold tabular-nums transition sm:py-2 ${
                    currency === 'V_MEDAL' ? 'px-1 text-center' : 'px-3'
                  } ${
                    amount === String(n)
                      ? currency === 'V_CREDIT'
                        ? 'border-green-600 bg-green-50 text-green-900'
                        : 'border-violet-600 bg-violet-50 text-violet-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {currency === 'V_CREDIT' ? `${n.toLocaleString()}${unit}` : `${n}M`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-gray-600">인당 지급 수량</p>
            <div className="flex gap-2">
              <div className="flex shrink-0 overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-50 shadow-sm">
                <button
                  type="button"
                  onClick={() => bumpAmount(-step)}
                  className="min-h-11 min-w-11 text-lg font-bold text-gray-700 hover:bg-white"
                  aria-label="감소"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => bumpAmount(step)}
                  className="min-h-11 min-w-11 text-lg font-bold text-gray-700 hover:bg-white"
                  aria-label="증가"
                >
                  +
                </button>
              </div>
              <input
                ref={amountInputRef}
                type="text"
                inputMode="numeric"
                value={formatIntegerWithCommas(amount)}
                onChange={(e) => setAmount(sanitizeIntegerInput(e.target.value))}
                className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 text-center text-lg font-bold tabular-nums tracking-tight text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/25"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-gray-600">사유 (선택)</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {REASON_QUICK.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setReason(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    reason === t
                      ? 'border-green-600 bg-green-50 text-green-900'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="직접 입력 · 비우면「관리자 지급」"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            />
          </div>

          {message && (
            <div
              role="status"
              className={`flex items-start gap-2 rounded-xl border-2 px-3 py-2.5 text-sm ${
                message.type === 'ok'
                  ? 'border-green-300 bg-green-50 text-green-950'
                  : message.type === 'warn'
                    ? 'border-amber-300 bg-amber-50 text-amber-950'
                    : 'border-red-300 bg-red-50 text-red-950'
              }`}
            >
              {message.type === 'ok' ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
              ) : message.type === 'warn' ? (
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              ) : (
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
              )}
              <span className="min-w-0 flex-1 leading-snug font-medium">{message.text}</span>
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold text-gray-600 hover:bg-black/5"
              >
                닫기
              </button>
            </div>
          )}

          <div className="mt-1">
            <button
              type="button"
              disabled={pending || picked.length === 0 || parsedAmount == null}
              onClick={() => void submitBatch()}
              className={`min-h-12 w-full rounded-xl px-4 text-sm font-bold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-45 ${
                currency === 'V_CREDIT' ? 'bg-green-600 hover:bg-green-700' : 'bg-violet-600 hover:bg-violet-700'
              }`}
            >
              {pending
                ? '처리 중…'
                : parsedAmount != null
                  ? `${picked.length}명에게 ${parsedAmount.toLocaleString()}${unit}씩 지급`
                  : `지급 (${picked.length}명)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
