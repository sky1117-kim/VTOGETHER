'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { uploadEventVerificationPhoto } from '@/api/actions/events'
import { submitHealthActivityLogsBatch, type HealthActivityEntryInput } from '@/api/actions/health-challenges'
import { HEALTH_CHALLENGE_MIN_PHOTOS_PER_ENTRY } from '@/constants/health-challenges'
import type { HealthSeasonPublic, HealthTrackPublic, HealthRollupRow } from '@/api/queries/health-challenges'
import { formatDecimalWithCommas, sanitizeDecimalInput } from '@/lib/number-format'

function seoulTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

type LocalEntry = {
  localId: string
  track_id: string
  activity_date: string
  distance_km: string
  speed_kmh: string
  elevation_m: string
  photo_urls: string[]
}

function emptyEntry(presetTrackId?: string): LocalEntry {
  return {
    localId: crypto.randomUUID(),
    track_id: presetTrackId ?? '',
    activity_date: seoulTodayYmd(),
    distance_km: '',
    speed_kmh: '',
    elevation_m: '',
    photo_urls: [],
  }
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

interface HealthChallengePanelProps {
  season: HealthSeasonPublic
  tracks: HealthTrackPublic[]
  year: number
  month: number
  rollups: HealthRollupRow[]
  pendingLogCount: number
  isLoggedIn: boolean
  /** true면 별도 대제목 없이 「이벤트 & 챌린지」 블록 안 서브 영역으로 표시 */
  embedded?: boolean
}

export function HealthChallengePanel({
  season,
  tracks,
  year,
  month,
  rollups,
  pendingLogCount,
  isLoggedIn,
  embedded = false,
}: HealthChallengePanelProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [entries, setEntries] = useState<LocalEntry[]>(() => [emptyEntry()])
  const [submitting, setSubmitting] = useState(false)
  const [uploadingEntryId, setUploadingEntryId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formOk, setFormOk] = useState<string | null>(null)

  useBodyScrollLock(modalOpen)

  const rollupByTrack = new Map(rollups.map((r) => [r.track_id, r]))

  const openModal = useCallback(() => {
    setFormError(null)
    setFormOk(null)
    setEntries([emptyEntry()])
    setModalOpen(true)
  }, [])

  const openModalForTrack = useCallback((trackId: string) => {
    setFormError(null)
    setFormOk(null)
    setEntries([emptyEntry(trackId)])
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  function updateEntry(localId: string, patch: Partial<LocalEntry>) {
    setEntries((prev) => prev.map((e) => (e.localId === localId ? { ...e, ...patch } : e)))
  }

  function addEntryRow() {
    setEntries((prev) => [...prev, emptyEntry()])
  }

  function removeEntryRow(localId: string) {
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.localId !== localId)))
  }

  async function onPickPhotos(localId: string, files: FileList | null) {
    if (!files?.length) return
    setUploadingEntryId(localId)
    setFormError(null)
    const urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fd = new FormData()
      fd.set('file', file)
      const { url, error } = await uploadEventVerificationPhoto(fd)
      if (error || !url) {
        setFormError(error ?? '사진 업로드 실패')
        setUploadingEntryId(null)
        return
      }
      urls.push(url)
    }
    const e = entries.find((x) => x.localId === localId)
    if (e) {
      updateEntry(localId, { photo_urls: [...e.photo_urls, ...urls] })
    }
    setUploadingEntryId(null)
  }

  function removePhoto(localId: string, url: string) {
    const e = entries.find((x) => x.localId === localId)
    if (!e) return
    updateEntry(localId, { photo_urls: e.photo_urls.filter((u) => u !== url) })
  }

  async function onSubmitModal(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormOk(null)
    if (!isLoggedIn) {
      setFormError('로그인 후 제출할 수 있습니다.')
      return
    }

    const payload: HealthActivityEntryInput[] = []
    for (let i = 0; i < entries.length; i++) {
      const row = entries[i]
      if (!row.track_id.trim()) {
        setFormError(`${i + 1}번째 인증: 종목을 선택하세요.`)
        return
      }
      if (row.photo_urls.length < HEALTH_CHALLENGE_MIN_PHOTOS_PER_ENTRY) {
        setFormError(`${i + 1}번째 인증: 사진을 ${HEALTH_CHALLENGE_MIN_PHOTOS_PER_ENTRY}장 이상 첨부하세요.`)
        return
      }
      const track = tracks.find((t) => t.track_id === row.track_id)
      if (!track) {
        setFormError(`${i + 1}번째 인증: 종목이 올바르지 않습니다.`)
        return
      }

      const distance_km = row.distance_km.trim() === '' ? null : parseFloat(sanitizeDecimalInput(row.distance_km))
      const speed_kmh = row.speed_kmh.trim() === '' ? null : parseFloat(sanitizeDecimalInput(row.speed_kmh))
      const elevation_m = row.elevation_m.trim() === '' ? null : parseFloat(sanitizeDecimalInput(row.elevation_m))

      payload.push({
        track_id: row.track_id,
        activity_date: row.activity_date.trim(),
        distance_km,
        speed_kmh,
        elevation_m,
        photo_urls: row.photo_urls,
      })
    }

    setSubmitting(true)
    const r = await submitHealthActivityLogsBatch(payload)
    setSubmitting(false)
    if (!r.success) {
      setFormError(r.error ?? '제출 실패')
      return
    }
    setFormOk(`${r.submitted}건 제출했습니다. 심사 후 누적에 반영됩니다.`)
    setEntries([emptyEntry()])
    router.refresh()
    setTimeout(() => {
      setModalOpen(false)
      setFormOk(null)
    }, 1600)
  }

  const modal =
    modalOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-black/50" onClick={closeModal} aria-hidden />
            <div
              className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="flex-shrink-0 border-b border-gray-100 px-5 py-4">
                <h3 className="text-lg font-bold text-gray-900">건강 챌린지 인증 제출</h3>
                <p className="mt-1 text-xs text-gray-500">
                  여러 번 활동했다면 &quot;인증 추가&quot;로 한 번에 여러 건 제출할 수 있습니다. 종목마다 사진을 여러 장 첨부할 수 있습니다.
                </p>
              </div>
              <form onSubmit={onSubmitModal} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-6">
                  {formError && (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>
                  )}
                  {formOk && (
                    <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{formOk}</div>
                  )}

                  {entries.map((row, idx) => {
                    const track = tracks.find((t) => t.track_id === row.track_id)
                    return (
                      <div
                        key={row.localId}
                        className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-gray-800">인증 {idx + 1}</span>
                          {entries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEntryRow(row.localId)}
                              className="text-xs font-medium text-red-600 hover:underline"
                            >
                              이 블록 삭제
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">종목 *</label>
                          <select
                            value={row.track_id}
                            onChange={(e) => updateEntry(row.localId, { track_id: e.target.value })}
                            className={inputClass}
                            required
                          >
                            <option value="">선택</option>
                            {tracks.map((t) => (
                              <option key={t.track_id} value={t.track_id}>
                                {t.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">활동일 *</label>
                          <input
                            type="date"
                            value={row.activity_date}
                            onChange={(e) => updateEntry(row.localId, { activity_date: e.target.value })}
                            className={inputClass}
                            required
                          />
                        </div>
                        {track?.metric === 'DISTANCE_KM' && (
                          <>
                            <div>
                              <label className="text-xs font-medium text-gray-500">이번 활동 거리 (km) *</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={formatDecimalWithCommas(row.distance_km)}
                                onChange={(e) => updateEntry(row.localId, { distance_km: sanitizeDecimalInput(e.target.value) })}
                                placeholder={
                                  track.min_distance_km != null
                                    ? `최소 ${track.min_distance_km}km 이상`
                                    : '거리'
                                }
                                className={inputClass}
                              />
                            </div>
                            {track.min_speed_kmh != null && (
                              <div>
                                <label className="text-xs font-medium text-gray-500">평균 속도 (km/h) *</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={formatDecimalWithCommas(row.speed_kmh)}
                                  onChange={(e) => updateEntry(row.localId, { speed_kmh: sanitizeDecimalInput(e.target.value) })}
                                  placeholder={`최소 ${track.min_speed_kmh}km/h 이상`}
                                  className={inputClass}
                                />
                              </div>
                            )}
                          </>
                        )}
                        {track?.metric === 'ELEVATION_M' && (
                          <div>
                            <label className="text-xs font-medium text-gray-500">이번 활동 누적 고도 (m) *</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formatDecimalWithCommas(row.elevation_m)}
                              onChange={(e) => updateEntry(row.localId, { elevation_m: sanitizeDecimalInput(e.target.value) })}
                              placeholder={
                                track.min_elevation_m != null
                                  ? `최소 ${track.min_elevation_m}m 이상`
                                  : '고도'
                              }
                              className={inputClass}
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-medium text-gray-500">
                            인증 사진 * ({HEALTH_CHALLENGE_MIN_PHOTOS_PER_ENTRY}장 이상, 여러 번 추가 가능)
                          </label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {row.photo_urls.map((url) => (
                              <div key={url} className="relative h-16 w-16 shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="h-full w-full rounded-lg border object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removePhoto(row.localId, url)}
                                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                                  aria-label="사진 제거"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              multiple
                              className="sr-only"
                              disabled={uploadingEntryId === row.localId}
                              onChange={(e) => {
                                onPickPhotos(row.localId, e.target.files)
                                e.target.value = ''
                              }}
                            />
                            {uploadingEntryId === row.localId ? '업로드 중…' : '사진 파일 선택 (여러 장)'}
                          </label>
                        </div>
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    onClick={addEntryRow}
                    className="w-full rounded-xl border border-green-200 bg-green-50/50 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50"
                  >
                    + 인증 추가 (다른 활동·다른 종목)
                  </button>
                </div>
                <div className="flex-shrink-0 flex flex-wrap gap-2 border-t border-gray-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !isLoggedIn}
                    className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? '제출 중…' : '전체 제출'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )
      : null

  const shellClass = embedded
    ? 'mb-10 border-t border-gray-200/90 pt-8'
    : 'mb-16'
  const ShellTag = embedded ? 'div' : 'section'

  return (
    <>
      <ShellTag id="health-challenge" className={shellClass}>
        <div className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${embedded ? 'mb-5' : 'mb-6'}`}>
          <div>
            {embedded ? (
              <>
                <h3 className="flex items-center gap-2.5 text-base font-bold text-gray-900">
                  <span className="h-6 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  건강 챌린지{' '}
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                    People
                  </span>
                </h3>
                <p className="mt-1.5 text-sm text-gray-500">
                  {season.name} · 종목별 월 누적으로 레벨 달성 후, 월말 V.Medal 정산
                </p>
              </>
            ) : (
              <>
                <h2 className="section-title flex items-center gap-3 text-gray-900">
                  <span className="h-8 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  건강 챌린지
                </h2>
                <p className="mt-1 text-gray-500">{season.name} · 종목별 월 누적으로 레벨 달성 후, 월말 V.Medal 정산</p>
              </>
            )}
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm text-emerald-900">
          <strong className="font-semibold">이번 달 ({year}년 {month}월)</strong>
          {isLoggedIn && pendingLogCount > 0 && (
            <span className="ml-2 text-emerald-800">승인 대기 인증 {pendingLogCount}건</span>
          )}
          {season.criteria_attachment_url?.trim() && (
            <div className="mt-2">
              <a
                href={season.criteria_attachment_url.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
              >
                참가 기준표·안내 보기 (새 창)
              </a>
            </div>
          )}
        </div>

        <p className="mb-3 text-sm text-gray-600">인증할 종목을 골라 바로 제출 창을 열 수 있습니다.</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {tracks.map((t) => (
            <button
              key={t.track_id}
              type="button"
              onClick={() => openModalForTrack(t.track_id)}
              className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 btn-press"
            >
              {t.title} 인증하기
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tracks.map((t) => {
            const r = rollupByTrack.get(t.track_id)
            const total = r?.approved_total ?? 0
            const lv = r?.achieved_level ?? 0
            const th = [...t.thresholds].sort((a, b) => a.level - b.level)
            const unit = t.metric === 'DISTANCE_KM' ? 'km' : 'm'
            return (
              <div
                key={t.track_id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-soft"
              >
                <h3 className="text-lg font-bold text-gray-900">{t.title}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  1회 최소:{' '}
                  {t.metric === 'DISTANCE_KM' ? (
                    <>
                      {t.min_distance_km != null && `${t.min_distance_km}km`}
                      {t.min_speed_kmh != null && ` · ${t.min_speed_kmh}km/h`}
                    </>
                  ) : (
                    t.min_elevation_m != null && `${t.min_elevation_m}m 고도`
                  )}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-gray-600">
                  {th.map((x) => (
                    <li key={x.level}>
                      L{x.level}: 월 합계 {x.target_value}
                      {unit} 이상
                    </li>
                  ))}
                </ul>
                {isLoggedIn && (
                  <div className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                    <div>
                      누적(승인 반영):{' '}
                      <strong>
                        {total.toLocaleString('ko-KR')}
                        {unit}
                      </strong>
                    </div>
                    <div className="mt-1">
                      현재 달성 레벨: <strong>L{lv}</strong>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={openModal}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 btn-press"
            >
              활동 인증 제출
            </button>
          ) : (
            <p className="text-sm text-gray-500">로그인 후 활동 인증을 제출할 수 있습니다.</p>
          )}
        </div>
      </ShellTag>
      {modal}
    </>
  )
}
