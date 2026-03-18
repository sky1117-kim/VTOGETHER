'use client'

import { useState } from 'react'
import { updateSiteContent, type SiteContentKey } from '@/api/actions/admin'

interface SiteContentFormProps {
  initial: Record<string, string>
}

const KEYS: { key: SiteContentKey; label: string; placeholder: string }[] = [
  { key: 'hero_season_badge', label: '시즌 뱃지', placeholder: '예: 2026 Season 1' },
  { key: 'hero_title', label: '메인 타이틀 (줄바꿈: \\n)', placeholder: '나의 활동이\\n세상의 기회가 되도록' },
  { key: 'hero_subtitle', label: '부제목 (줄바꿈: \\n)', placeholder: '획득한 V.Credit로 기부하고\\n나의 ESG Level을 올려보세요!' },
]

export function SiteContentForm({ initial }: SiteContentFormProps) {
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSave(key: SiteContentKey) {
    setMessage(null)
    setPending(true)
    const value = (values[key] ?? '').replace(/\\n/g, '\n')
    const result = await updateSiteContent(key, value)
    setPending(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'ok', text: '저장되었습니다. 메인 화면을 새로고침하면 반영됩니다.' })
  }

  return (
    <div className="space-y-4">
      {KEYS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={values[key] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => handleSave(key)}
              disabled={pending}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      ))}
      {message && (
        <p
          className={`text-sm ${message.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
