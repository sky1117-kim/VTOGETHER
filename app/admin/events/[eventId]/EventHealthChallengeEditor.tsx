'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createHealthSeason,
  refillDefaultTracksForSeason,
  updateLinkedHealthSeasonRules,
  type LinkedHealthSeasonEditorData,
  type LinkedHealthSeasonEditorTrackRow,
} from '@/api/actions/admin/health-challenges'
import { uploadHealthCriteriaAttachment } from '@/api/actions/events'

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500'
const labelClass = 'block text-xs font-bold text-gray-600'
const smallInput = 'mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm'

const KIND_LABEL: Record<LinkedHealthSeasonEditorTrackRow['kind'], string> = {
  WALK: '걷기 — 월 누적 거리(km)',
  RUN: '러닝 — 월 누적 거리(km) + 1회 최소 속도',
  HIKE: '하이킹 — 월 누적 고도(m)',
  RIDE: '라이딩 — 월 누적 거리(km) + 1회 최소 속도',
}

function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function parseNullable(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function parseRequiredNonNeg(s: string, label: string): { ok: true; n: number } | { ok: false; err: string } {
  const t = s.trim()
  if (t === '') return { ok: false, err: `${label}을(를) 입력하세요.` }
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return { ok: false, err: `${label}은(는) 0 이상 숫자여야 합니다.` }
  return { ok: true, n }
}

type TrackFormState = {
  kind: LinkedHealthSeasonEditorTrackRow['kind']
  title: string
  min_distance_km: string
  min_speed_kmh: string
  min_elevation_m: string
  level1: string
  level2: string
  level3: string
}

function rowsToForm(tracks: LinkedHealthSeasonEditorTrackRow[]): TrackFormState[] {
  return tracks.map((t) => ({
    kind: t.kind,
    title: t.title,
    min_distance_km: t.min_distance_km != null ? String(t.min_distance_km) : '',
    min_speed_kmh: t.min_speed_kmh != null ? String(t.min_speed_kmh) : '',
    min_elevation_m: t.min_elevation_m != null ? String(t.min_elevation_m) : '',
    level1: String(t.level1),
    level2: String(t.level2),
    level3: String(t.level3),
  }))
}

export function EventHealthChallengeEditor({
  eventId,
  eventTitle,
  initial,
}: {
  eventId: string
  eventTitle: string
  initial: LinkedHealthSeasonEditorData | null
}) {
  const router = useRouter()
  const now = useMemo(() => new Date(), [])
  const defaultRange = useMemo(() => monthRange(now.getFullYear(), now.getMonth() + 1), [now])

  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  const [attachStart, setAttachStart] = useState(defaultRange.start)
  const [attachEnd, setAttachEnd] = useState(defaultRange.end)
  const [attachSlug, setAttachSlug] = useState('')
  const [attachStatus, setAttachStatus] = useState<'DRAFT' | 'ACTIVE'>('ACTIVE')

  const [seasonName, setSeasonName] = useState(initial?.name ?? eventTitle)
  const [startDate, setStartDate] = useState(initial?.startDate ?? defaultRange.start)
  const [endDate, setEndDate] = useState(initial?.endDate ?? defaultRange.end)
  const [seasonStatus, setSeasonStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>(
    initial?.status ?? 'DRAFT'
  )
  const [trackRows, setTrackRows] = useState<TrackFormState[]>(() =>
    initial ? rowsToForm(initial.tracks) : []
  )
  const [criteriaUrl, setCriteriaUrl] = useState(initial?.criteria_attachment_url ?? '')
  const [criteriaUploading, setCriteriaUploading] = useState(false)

  async function onCriteriaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCriteriaUploading(true)
    setMessage(null)
    const fd = new FormData()
    fd.set('file', file)
    const r = await uploadHealthCriteriaAttachment(fd)
    setCriteriaUploading(false)
    if (r.error) {
      setMessage({ type: 'err', text: r.error })
      return
    }
    if (r.url) setCriteriaUrl(r.url)
  }

  async function onCreateSeason(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setPending(true)
    const r = await createHealthSeason({
      name: eventTitle.trim() || '건강 챌린지',
      slug: attachSlug,
      startDate: attachStart,
      endDate: attachEnd,
      status: attachStatus,
      eventId,
      criteriaAttachmentUrl: criteriaUrl.trim() || null,
    })
    setPending(false)
    if (!r.success) {
      setMessage({ type: 'err', text: r.error ?? '시즌 생성 실패' })
      return
    }
    setMessage({ type: 'ok', text: '건강 챌린지 시즌을 만들었습니다. 아래에서 룰을 조정하세요.' })
    router.refresh()
  }

  async function onSaveRules(e: React.FormEvent) {
    e.preventDefault()
    if (!initial) return
    setMessage(null)

    const tracksPayload: Parameters<typeof updateLinkedHealthSeasonRules>[1]['tracks'] = []

    for (const row of trackRows) {
      const l1 = parseRequiredNonNeg(row.level1, `${KIND_LABEL[row.kind]} L1`)
      const l2 = parseRequiredNonNeg(row.level2, 'L2')
      const l3 = parseRequiredNonNeg(row.level3, 'L3')
      if (!l1.ok) {
        setMessage({ type: 'err', text: l1.err })
        return
      }
      if (!l2.ok) {
        setMessage({ type: 'err', text: l2.err })
        return
      }
      if (!l3.ok) {
        setMessage({ type: 'err', text: l3.err })
        return
      }
      tracksPayload.push({
        kind: row.kind,
        title: row.title.trim(),
        min_distance_km: parseNullable(row.min_distance_km),
        min_speed_kmh: parseNullable(row.min_speed_kmh),
        min_elevation_m: parseNullable(row.min_elevation_m),
        level1: l1.n,
        level2: l2.n,
        level3: l3.n,
      })
    }

    setPending(true)
    const r = await updateLinkedHealthSeasonRules(eventId, {
      seasonName: seasonName.trim(),
      startDate,
      endDate,
      status: seasonStatus,
      criteriaAttachmentUrl: criteriaUrl.trim() || null,
      tracks: tracksPayload,
    })
    setPending(false)
    if (!r.success) {
      setMessage({ type: 'err', text: r.error ?? '저장 실패' })
      return
    }
    setMessage({ type: 'ok', text: '건강 챌린지 룰을 저장했습니다.' })
    router.refresh()
  }

  async function onRefillDefaults() {
    if (!initial) return
    if (!confirm('기획 기본값으로 4종목·레벨을 채웁니다. 이미 있는 값은 덮어씁니다. 계속할까요?')) return
    setPending(true)
    const r = await refillDefaultTracksForSeason(initial.season_id)
    setPending(false)
    if (!r.success) {
      setMessage({ type: 'err', text: r.error ?? '실패' })
      return
    }
    router.refresh()
  }

  function patchRow(idx: number, patch: Partial<TrackFormState>) {
    setTrackRows((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  if (!initial) {
    return (
      <form onSubmit={onCreateSeason} className="space-y-4">
        {message && (
          <div
            className={`rounded-lg px-4 py-2 text-sm ${
              message.type === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}
        <p className="text-sm text-gray-600">
          아직 이 이벤트에 연결된 건강 챌린지 시즌이 없습니다. 기간을 정하고 시즌을 만들면 기본 4종목·레벨이
          채워집니다. 생성 후 이 섹션에서 세부 룰을 바로 수정할 수 있습니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>시즌 시작일</label>
            <input type="date" value={attachStart} onChange={(e) => setAttachStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>시즌 종료일</label>
            <input type="date" value={attachEnd} onChange={(e) => setAttachEnd(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>슬러그 (선택)</label>
            <input
              type="text"
              value={attachSlug}
              onChange={(e) => setAttachSlug(e.target.value)}
              className={inputClass}
              placeholder="비우면 자동 생성"
            />
          </div>
          <div>
            <label className={labelClass}>오픈 상태</label>
            <select
              value={attachStatus}
              onChange={(e) => setAttachStatus(e.target.value as 'DRAFT' | 'ACTIVE')}
              className={inputClass}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>참가 기준표 (PDF·이미지 URL 또는 파일 첨부)</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                type="url"
                value={criteriaUrl}
                onChange={(e) => setCriteriaUrl(e.target.value)}
                className={`min-w-[200px] flex-1 ${inputClass}`}
                placeholder="https://..."
              />
              <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <input type="file" accept=".pdf,image/*" className="sr-only" onChange={onCriteriaFile} disabled={criteriaUploading} />
                {criteriaUploading ? '업로드…' : '파일 첨부'}
              </label>
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? '처리 중…' : '건강 챌린지 시즌 만들기'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={onSaveRules} className="space-y-6">
      {message && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            message.type === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          슬러그 <code className="rounded bg-gray-100 px-1">{initial.slug}</code>
        </p>
        <button
          type="button"
          onClick={onRefillDefaults}
          disabled={pending}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          기획 기본값으로 4종목·레벨 다시 채우기
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>시즌 표시 이름</label>
          <input type="text" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>시작일 (서울)</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>종료일 (서울)</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>시즌 상태</label>
          <select
            value={seasonStatus}
            onChange={(e) => setSeasonStatus(e.target.value as typeof seasonStatus)}
            className={inputClass}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE (다른 ACTIVE 시즌은 보관)</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>참가 기준표 (PDF·이미지)</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              type="url"
              value={criteriaUrl}
              onChange={(e) => setCriteriaUrl(e.target.value)}
              className={`min-w-[200px] flex-1 ${inputClass}`}
              placeholder="공개 URL"
            />
            <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <input type="file" accept=".pdf,image/*" className="sr-only" onChange={onCriteriaFile} disabled={criteriaUploading} />
              {criteriaUploading ? '업로드…' : '파일 첨부'}
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-bold text-gray-800">4종목 — 1회 인증 최소 조건 · 월 누적 L1~L3</h4>
        {trackRows.map((row, idx) => (
          <div key={row.kind} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
            <p className="text-sm font-semibold text-gray-900">{KIND_LABEL[row.kind]}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>종목 이름</label>
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) => patchRow(idx, { title: e.target.value })}
                  className={smallInput}
                />
              </div>
              {(row.kind === 'WALK' || row.kind === 'RUN' || row.kind === 'RIDE') && (
                <div>
                  <label className={labelClass}>1회 최소 거리 (km, 빈칸=제한 없음)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.min_distance_km}
                    onChange={(e) => patchRow(idx, { min_distance_km: e.target.value })}
                    className={smallInput}
                  />
                </div>
              )}
              {(row.kind === 'RUN' || row.kind === 'RIDE') && (
                <div>
                  <label className={labelClass}>1회 최소 평균 속도 (km/h)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.min_speed_kmh}
                    onChange={(e) => patchRow(idx, { min_speed_kmh: e.target.value })}
                    className={smallInput}
                  />
                </div>
              )}
              {row.kind === 'HIKE' && (
                <div>
                  <label className={labelClass}>1회 최소 고도 (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.min_elevation_m}
                    onChange={(e) => patchRow(idx, { min_elevation_m: e.target.value })}
                    className={smallInput}
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>월 누적 L1 목표 (km 또는 m)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.level1}
                  onChange={(e) => patchRow(idx, { level1: e.target.value })}
                  className={smallInput}
                />
              </div>
              <div>
                <label className={labelClass}>L2</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.level2}
                  onChange={(e) => patchRow(idx, { level2: e.target.value })}
                  className={smallInput}
                />
              </div>
              <div>
                <label className={labelClass}>L3</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.level3}
                  onChange={(e) => patchRow(idx, { level3: e.target.value })}
                  className={smallInput}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {pending ? '저장 중…' : '건강 챌린지 룰 저장'}
      </button>
    </form>
  )
}
