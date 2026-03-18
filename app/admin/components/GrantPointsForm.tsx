'use client'

import { useState, useMemo } from 'react'
import { grantPoints } from '@/api/actions/admin'
import type { UserRow } from '@/api/actions/admin'
import { Search } from 'lucide-react'

interface GrantPointsFormProps {
  users: UserRow[]
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s/g, '')
}

export function GrantPointsForm({ users }: GrantPointsFormProps) {
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(users[0] ?? null)
  const [amount, setAmount] = useState('1000')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users.slice(0, 20)
    const q = normalize(search.trim())
    return users.filter(
      (u) =>
        normalize(u.name ?? '').includes(q) ||
        normalize(u.email ?? '').includes(q) ||
        (u.dept_name && normalize(u.dept_name).includes(q))
    )
  }, [users, search])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!selectedUser) {
      setMessage({ type: 'error', text: '대상 사용자를 검색해서 선택해주세요.' })
      return
    }
    const num = parseInt(amount, 10)
    if (Number.isNaN(num) || num < 1) {
      setMessage({ type: 'error', text: '1 이상의 숫자를 입력해주세요.' })
      return
    }
    setPending(true)
    const result = await grantPoints(selectedUser.user_id, num, reason.trim() || undefined)
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: `${selectedUser.name || selectedUser.email}에게 ${num.toLocaleString()}P 지급 완료되었습니다.` })
    setAmount('1000')
    setReason('')
  }

  /** 테스트용: 선택한 사용자에게 5만 P 한 번에 지급 */
  async function handleGrant50k() {
    setMessage(null)
    if (!selectedUser) {
      setMessage({ type: 'error', text: '대상 사용자를 검색해서 선택해주세요.' })
      return
    }
    setPending(true)
    const result = await grantPoints(selectedUser.user_id, 50000, '테스트용 지급')
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: '50,000P 지급 완료. 메인에서 기부 테스트해보세요.' })
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        사용자가 없습니다. 메인에서 Google로 로그인한 뒤 다시 확인해주세요.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-bold text-gray-700">대상 사용자</label>
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Search className="size-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
            placeholder="이름, 이메일, 부서로 검색..."
            className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {showDropdown && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              {filteredUsers.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-500">검색 결과 없음</li>
              ) : (
                filteredUsers.map((u) => (
                  <li key={u.user_id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(u)
                        setSearch(u.name || u.email)
                        setShowDropdown(false)
                      }}
                      className={`flex w-full flex-col px-4 py-2.5 text-left text-sm hover:bg-gray-50 ${
                        selectedUser?.user_id === u.user_id ? 'bg-green-50 text-green-800' : 'text-gray-900'
                      }`}
                    >
                      <span className="font-medium">{u.name || '—'}</span>
                      <span className="text-xs text-gray-500">{u.email} · {u.current_points.toLocaleString()}P 보유</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        {selectedUser && (
          <p className="mt-1.5 text-xs text-gray-600">
            선택: <strong>{selectedUser.name || selectedUser.email}</strong> ({selectedUser.email})
          </p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-bold text-gray-700">지급 포인트 (P)</label>
        <div className="flex flex-wrap gap-2">
          {[1000, 5000, 10000, 30000, 50000].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(String(n))}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                amount === String(n)
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {n.toLocaleString()}P
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="직접 입력"
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-bold text-gray-700">지급 사유 <span className="font-normal text-gray-500">(선택)</span></label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 기부 테스트용, 이벤트 보상 등"
          className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <p className="mt-0.5 text-xs text-gray-500">비워두면 &quot;관리자 지급&quot;으로 기록됩니다.</p>
      </div>
      {message && (
        <p
          className={`text-sm font-medium ${
            message.type === 'ok' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-bold text-white transition hover:bg-green-700 disabled:opacity-50 btn-press"
        >
          {pending ? '처리 중…' : '포인트 지급'}
        </button>
        <button
          type="button"
          onClick={handleGrant50k}
          disabled={pending}
          className="shrink-0 rounded-xl border-2 border-green-600 bg-white px-4 py-3 font-bold text-green-600 transition hover:bg-green-50 disabled:opacity-50 btn-press"
        >
          테스트용 5만 P
        </button>
      </div>
    </form>
  )
}
