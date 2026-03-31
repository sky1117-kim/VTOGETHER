'use client'

import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { uploadEventVerificationPhoto } from '@/api/actions/events'
import { uploadEventPhotoClient } from '@/lib/upload-event-photo'
import { submitHealthActivityLogsBatch, type HealthActivityEntryInput } from '@/api/actions/health-challenges'
import { HEALTH_CHALLENGE_MIN_PHOTOS_PER_ENTRY } from '@/constants/health-challenges'
import type { HealthTrackPublic, HealthSeasonPublic, HealthSubmittedTrackInfo } from '@/api/queries/health-challenges'
import { formatDecimalWithCommas, sanitizeDecimalInput } from '@/lib/number-format'

type LocalEntry = {
  localId: string
  track_id: string
  activity_dates: string[]
  calendar_month: string
  distance_km: string
  speed_kmh: string
  elevation_m: string
  photo_urls: string[]
}

function seoulTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function emptyEntry(presetTrackId?: string): LocalEntry {
  const today = seoulTodayYmd()
  return {
    localId: crypto.randomUUID(),
    track_id: presetTrackId ?? '',
    activity_dates: [],
    calendar_month: today.slice(0, 7),
    distance_km: '',
    speed_kmh: '',
    elevation_m: '',
    photo_urls: [],
  }
}

function getSeasonBounds(season: HealthSeasonPublic): { startYmd: string; endYmd: string } {
  const startYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(season.starts_at))
  const endYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(season.ends_at))
  return { startYmd, endYmd }
}

function isYmdInRange(ymd: string, startYmd: string, endYmd: string): boolean {
  return ymd >= startYmd && ymd <= endYmd
}

function buildMonthCells(month: string): Array<{ ymd: string; day: number } | null> {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return []
  const firstWeekday = new Date(y, m - 1, 1).getDay()
  const lastDay = new Date(y, m, 0).getDate()
  const cells: Array<{ ymd: string; day: number } | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= lastDay; d++) {
    cells.push({
      ymd: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      day: d,
    })
  }
  return cells
}

function trackUnit(metric: HealthTrackPublic['metric']): string {
  return metric === 'DISTANCE_KM' ? 'km' : 'm'
}

type HealthChallengeVerifyModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  isLoggedIn: boolean
  season: HealthSeasonPublic
  tracks: HealthTrackPublic[]
  /** 하위호환 props (더 이상 선택 제한에는 사용하지 않음) */
  submittedTrackIds: string[]
  submittedTrackInfos: HealthSubmittedTrackInfo[]
}

export function HealthChallengeVerifyModal({
  isOpen,
  onClose,
  onSuccess,
  isLoggedIn,
  season,
  tracks,
  submittedTrackIds,
  submittedTrackInfos,
}: HealthChallengeVerifyModalProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<LocalEntry[]>(() => [emptyEntry()])
  const [submitting, setSubmitting] = useState(false)
  const [uploadingEntryId, setUploadingEntryId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formOk, setFormOk] = useState<string | null>(null)

  useBodyScrollLock(isOpen)

  // 같은 제출 화면 안에서는 같은 종목 중복 선택을 막습니다.
  const selectedTrackIds = new Set(entries.map((e) => e.track_id).filter(Boolean))
  const submittedTrackIdSet = new Set(submittedTrackIds)
  const submittedInfoByTrackId = new Map(submittedTrackInfos.map((x) => [x.track_id, x]))

  const modalScrollRef = useRef<HTMLDivElement | null>(null)
  const photoPickerScrollTopRef = useRef<number | null>(null)
  const fileInputByEntryRef = useRef<Record<string, HTMLInputElement | null>>({})
  const { startYmd: seasonStartYmd, endYmd: seasonEndYmd } = getSeasonBounds(season)

  const close = useCallback(() => {
    setFormError(null)
    setFormOk(null)
    onClose()
  }, [onClose])

  if (!isOpen) return null

  function patchEntry(localId: string, patch: Partial<LocalEntry>) {
    setEntries((prev) => prev.map((e) => (e.localId === localId ? { ...e, ...patch } : e)))
  }

  function addEntry(presetTrackId?: string) {
    // 4개 종목(걷기/러닝/하이킹/라이딩) 기준으로 종목 블록은 최대 4개
    if (entries.length >= 4) return
    setEntries((prev) => [...prev, emptyEntry(presetTrackId)])
  }

  function removeEntry(localId: string) {
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.localId !== localId)))
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

  async function onPickPhotos(localId: string, files: File[]) {
    if (!files.length) return
    setUploadingEntryId(localId)
    setFormError(null)

    const urls: string[] = []
    let failedCount = 0
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        let result = await uploadEventPhotoClient(file)
        if (result.error) {
          const fd = new FormData()
          fd.set('file', file)
          result = await uploadEventVerificationPhoto(fd)
        }
        if (result.error || !result.url) {
          failedCount += 1
          continue
        }
        urls.push(result.url)
      }

      if (urls.length > 0) {
        setEntries((prev) =>
          prev.map((e) => (e.localId === localId ? { ...e, photo_urls: [...e.photo_urls, ...urls] } : e)),
        )
      }
      if (failedCount > 0) {
        setFormError(`${failedCount}장 업로드에 실패했습니다. 형식(jpg/png/webp/gif)과 용량(5MB 이하)을 확인해주세요.`)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '사진 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingEntryId(null)
    }
  }

  function removePhoto(localId: string, url: string) {
    const e = entries.find((x) => x.localId === localId)
    if (!e) return
    patchEntry(localId, { photo_urls: e.photo_urls.filter((u) => u !== url) })
  }

  function rememberPhotoPickerScrollPosition() {
    photoPickerScrollTopRef.current = modalScrollRef.current?.scrollTop ?? null
  }

  function restorePhotoPickerScrollPosition() {
    const top = photoPickerScrollTopRef.current
    if (top == null) return
    // 파일 썸네일 렌더 이후 레이아웃이 한 번 더 바뀔 수 있어 2프레임 뒤 복원합니다.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modalScrollRef.current?.scrollTo({ top, behavior: 'auto' })
        photoPickerScrollTopRef.current = null
      })
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormOk(null)

    const fail = (msg: string) => {
      setFormError(msg)
      // 에러는 모달 맨 위에 렌더되므로, 사용자가 바로 보게 스크롤 위치를 맞춥니다.
      requestAnimationFrame(() => {
        modalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }

    if (!isLoggedIn) {
      fail('로그인 후 제출할 수 있습니다.')
      return
    }

    const payload: HealthActivityEntryInput[] = []
    const skippedIndices: number[] = []
    for (let i = 0; i < entries.length; i++) {
      const row = entries[i]
      // 입력이 덜 된 인증은 "전체 제출"에 섞이지 않도록 제외(부분 제출 UX)
      if (!row.track_id.trim() || row.photo_urls.length < HEALTH_CHALLENGE_MIN_PHOTOS_PER_ENTRY) {
        skippedIndices.push(i + 1)
        continue
      }

      const track = tracks.find((t) => t.track_id === row.track_id)
      if (!track) {
        // UI에서 종목은 제한하지만, 혹시 모를 불일치가 있으면 서버에서 잡기보다 제외합니다.
        skippedIndices.push(i + 1)
        continue
      }

      const distance_km = row.distance_km.trim() === '' ? null : parseFloat(sanitizeDecimalInput(row.distance_km))
      const speed_kmh = row.speed_kmh.trim() === '' ? null : parseFloat(sanitizeDecimalInput(row.speed_kmh))
      const elevation_m = row.elevation_m.trim() === '' ? null : parseFloat(sanitizeDecimalInput(row.elevation_m))

      const dates = [...new Set(row.activity_dates)].sort()
      if (dates.length === 0) {
        skippedIndices.push(i + 1)
        continue
      }
      for (const activityDate of dates) {
        payload.push({
          track_id: row.track_id,
          activity_date: activityDate.trim(),
          distance_km,
          speed_kmh,
          elevation_m,
          photo_urls: row.photo_urls,
        })
      }
    }

    if (!payload.length) {
      fail(`제출 가능한 인증 항목이 없습니다. (입력 미완성 항목: ${skippedIndices.join(', ')})`)
      return
    }

    setSubmitting(true)
    const r = await submitHealthActivityLogsBatch(payload)
    setSubmitting(false)

    if (!r.success) {
      fail(r.error ?? '제출 실패')
      return
    }

    if (skippedIndices.length > 0) {
      setFormOk(
        `${r.submitted}건 제출했습니다. 입력이 미완성인 인증( ${skippedIndices.join(', ')}번째 )은 제외됩니다. 심사 후 누적에 반영됩니다.`,
      )
    } else {
      setFormOk(`${r.submitted}건 제출했습니다. 심사 후 누적에 반영됩니다.`)
    }
    // 성공 시: 메인 새로고침 및 모달 닫기
    setTimeout(() => {
      onSuccess()
      router.refresh()
      close()
    }, 1200)
  }

  const selectableTrackCount = tracks.filter((t) => !selectedTrackIds.has(t.track_id)).length
  const submittedTrackTitles = tracks.filter((t) => submittedTrackIdSet.has(t.track_id)).map((t) => t.title)

  const trackGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {tracks.map((t) => {
        const isSubmitted = submittedTrackIdSet.has(t.track_id)
        const submittedInfo = submittedInfoByTrackId.get(t.track_id)
        const isSelectedInThisModal = selectedTrackIds.has(t.track_id)
        const isDisabled = isSelectedInThisModal
        const unit = trackUnit(t.metric)
        const th = [...t.thresholds].sort((a, b) => a.level - b.level)
        const submissionStatusLabel =
          submittedInfo?.status === 'APPROVED'
            ? '승인 완료'
            : submittedInfo?.status === 'PENDING'
              ? '승인 대기중'
              : '이미 제출'
        const submittedValues = submittedInfo
          ? [
              submittedInfo.distance_km != null ? `거리 ${submittedInfo.distance_km}km` : null,
              submittedInfo.speed_kmh != null ? `속도 ${submittedInfo.speed_kmh}km/h` : null,
              submittedInfo.elevation_m != null ? `고도 ${submittedInfo.elevation_m}m` : null,
            ].filter(Boolean) as string[]
          : []
        return (
          <button
            key={t.track_id}
            type="button"
            disabled={isDisabled}
            onClick={() => {
              const first = entries[0]
              if (entries.length === 1 && !first.track_id) {
                patchEntry(first.localId, { track_id: t.track_id })
              } else {
                addEntry(t.track_id)
              }
            }}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              isDisabled
                ? 'cursor-not-allowed border-gray-200 bg-gray-100/70 text-gray-500'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-gray-900">{t.title}</div>
                <div className="mt-1 text-xs text-gray-500">
                  활동 입력 가이드:{' '}
                  {t.metric === 'DISTANCE_KM' ? (
                    <>
                      {t.min_distance_km != null ? `${t.min_distance_km}${unit}` : '제한없음'}
                      {t.min_speed_kmh != null ? ` · ${t.min_speed_kmh}km/h` : ''}
                    </>
                  ) : (
                    <>{t.min_elevation_m != null ? `${t.min_elevation_m}${unit}` : '제한없음'} 고도</>
                  )}
                </div>
              </div>
              {isSelectedInThisModal ? (
                <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                  선택됨
                </span>
              ) : isSubmitted ? (
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${
                    submittedInfo?.status === 'APPROVED'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-900'
                      : 'border-amber-200 bg-amber-100 text-amber-900'
                  }`}
                >
                  {submissionStatusLabel}
                </span>
              ) : (
                <span className="rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-[10px] font-extrabold text-sky-900">
                  선택
                </span>
              )}
            </div>
            <ul className="mt-3 space-y-1 text-xs text-gray-700">
              {th.map((x) => (
                <li key={x.level}>
                  L{x.level}: 월 합계 {x.target_value}
                  {unit} 이상
                </li>
              ))}
            </ul>
            {isSubmitted && (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] font-medium text-amber-700">
                  기존 제출 이력이 있습니다. 같은 종목도 활동일이 다르면 다시 제출할 수 있습니다.
                </p>
                {submittedInfo && (
                  <>
                    <p className="text-[10px] text-gray-500">
                      제출일: {new Date(submittedInfo.created_at).toLocaleDateString('ko-KR')}
                    </p>
                    {submittedValues.length > 0 && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-2 py-1.5">
                        <p className="text-[10px] font-semibold text-emerald-800">내 제출값</p>
                        <p className="mt-0.5 text-[11px] font-bold text-emerald-900">{submittedValues.join(' · ')}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )

  const modal = (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden />
      <div
        className="relative z-10 flex max-h-[min(92vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex-shrink-0 border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-bold text-gray-900">건강 챌린지 인증 제출</h3>
          <p className="mt-1 text-xs text-gray-500">
            {season.name} · 같은 종목도 활동일이 다르면 제출할 수 있으며, 제출값은 해당 종목의 월 누적 달성 수치로 심사됩니다.
          </p>
          {season.criteria_attachment_url?.trim() ? (
            <a
              href={season.criteria_attachment_url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
            >
              참가 기준표·안내 보기
            </a>
          ) : null}
        </div>

        {/* 폼 자체는 고정 높이를 차지하지 않고, 본문만 최대 높이에서 스크롤되게 유지 */}
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col overflow-hidden">
          <div
            ref={modalScrollRef}
            className="min-h-0 max-h-[min(72vh,calc(92vh-13rem))] overflow-y-auto space-y-6 px-5 py-4"
          >
            {formError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>}
            {formOk && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{formOk}</div>}
            {submittedTrackTitles.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                기존 제출 이력 종목(참고): <strong>{submittedTrackTitles.join(', ')}</strong>
              </div>
            )}

            {trackGrid}

            {entries.map((row, idx) => {
              const track = tracks.find((t) => t.track_id === row.track_id)
              const levelOneThreshold = track?.thresholds.find((x) => x.level === 1)?.target_value
              const availableTracksForRow = tracks.filter(
                (t) =>
                  !selectedTrackIds.has(t.track_id) || t.track_id === row.track_id,
              )
              return (
                <div key={row.localId} className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-gray-800">인증 {idx + 1}</span>
                    {entries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEntry(row.localId)}
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
                      onChange={(e) => patchEntry(row.localId, { track_id: e.target.value })}
                      className={inputClass}
                      required
                    >
                      <option value="">선택</option>
                      {availableTracksForRow.map((t) => (
                        <option key={t.track_id} value={t.track_id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500">활동일 *</label>
                    <div className="mt-1 space-y-2 rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-500">월 선택 후 날짜를 여러 개 클릭하세요.</span>
                        <input
                          type="month"
                          value={row.calendar_month}
                          min={seasonStartYmd.slice(0, 7)}
                          max={seasonEndYmd.slice(0, 7)}
                          onChange={(e) =>
                            patchEntry(row.localId, {
                              calendar_month: e.target.value,
                              activity_dates: row.activity_dates.filter((d) => d.startsWith(`${e.target.value}-`)),
                            })
                          }
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400">
                        {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                          <span key={w}>{w}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {buildMonthCells(row.calendar_month).map((cell, i) => {
                          if (!cell) return <div key={`empty-${i}`} className="h-8" />
                          const enabled = isYmdInRange(cell.ymd, seasonStartYmd, seasonEndYmd)
                          const selected = row.activity_dates.includes(cell.ymd)
                          return (
                            <button
                              key={cell.ymd}
                              type="button"
                              disabled={!enabled}
                              onClick={() => {
                                if (!enabled) return
                                const has = row.activity_dates.includes(cell.ymd)
                                const next = has
                                  ? row.activity_dates.filter((d) => d !== cell.ymd)
                                  : [...row.activity_dates, cell.ymd]
                                patchEntry(row.localId, { activity_dates: next.sort() })
                              }}
                              className={`h-8 rounded-md text-xs font-semibold ${
                                !enabled
                                  ? 'cursor-not-allowed bg-gray-100 text-gray-300'
                                  : selected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {cell.day}
                            </button>
                          )
                        })}
                      </div>
                      {row.activity_dates.length > 0 ? (
                        <p className="text-[11px] text-gray-600">
                          선택됨: {row.activity_dates.sort().join(', ')}
                        </p>
                      ) : (
                        <p className="text-[11px] text-red-600">활동일을 1개 이상 선택하세요.</p>
                      )}
                    </div>
                  </div>

                  {track?.metric === 'DISTANCE_KM' && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-gray-500">해당 월 누적 거리 (km) *</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatDecimalWithCommas(row.distance_km)}
                          onChange={(e) => patchEntry(row.localId, { distance_km: sanitizeDecimalInput(e.target.value) })}
                          placeholder={
                            levelOneThreshold != null
                              ? `누적 거리 입력 (레벨 1 기준 ${levelOneThreshold}km)`
                              : track.min_distance_km != null
                                ? `누적 거리 입력 (레벨 1 기준 ${track.min_distance_km}km)`
                                : '누적 거리'
                          }
                          className={inputClass}
                        />
                      </div>
                      {track.min_speed_kmh != null && (
                        <div>
                          <label className="text-xs font-medium text-gray-500">평균 속도 (km/h, 선택)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formatDecimalWithCommas(row.speed_kmh)}
                            onChange={(e) => patchEntry(row.localId, { speed_kmh: sanitizeDecimalInput(e.target.value) })}
                            placeholder={`참고 입력 (레벨 1 기준 ${track.min_speed_kmh}km/h)`}
                            className={inputClass}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {track?.metric === 'ELEVATION_M' && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">해당 월 누적 고도 (m) *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatDecimalWithCommas(row.elevation_m)}
                        onChange={(e) => patchEntry(row.localId, { elevation_m: sanitizeDecimalInput(e.target.value) })}
                        placeholder={
                          levelOneThreshold != null
                            ? `누적 고도 입력 (레벨 1 기준 ${levelOneThreshold}m)`
                            : track.min_elevation_m != null
                              ? `누적 고도 입력 (레벨 1 기준 ${track.min_elevation_m}m)`
                              : '누적 고도'
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

                    <input
                      ref={(el) => {
                        fileInputByEntryRef.current[row.localId] = el
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      disabled={uploadingEntryId === row.localId}
                      onChange={async (e) => {
                        const pickedFiles = Array.from(e.target.files ?? [])
                        await onPickPhotos(row.localId, pickedFiles)
                        e.target.value = ''
                        restorePhotoPickerScrollPosition()
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (uploadingEntryId === row.localId) return
                        rememberPhotoPickerScrollPosition()
                        fileInputByEntryRef.current[row.localId]?.click()
                      }}
                      className="mt-2 inline-flex items-center rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={uploadingEntryId === row.localId}
                    >
                      {uploadingEntryId === row.localId ? '업로드 중…' : '사진 파일 선택 (여러 장)'}
                    </button>
                  </div>
                </div>
              )
            })}

            <button
              type="button"
              onClick={() => addEntry()}
              disabled={entries.length >= 4 || selectableTrackCount === 0}
              className="w-full rounded-xl border border-green-200 bg-green-50/50 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50"
            >
              + 인증 추가 (다른 종목)
            </button>
          </div>

          <div className="flex-shrink-0 flex flex-wrap gap-2 border-t border-gray-100 px-5 py-4">
            <button
              type="button"
              onClick={close}
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
    </div>
  )

  return createPortal(modal, document.body)
}

