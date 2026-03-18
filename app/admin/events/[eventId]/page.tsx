import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEventWithRoundsForAdmin } from '@/api/actions/admin/events'
import { AddRoundsForm } from './AddRoundsForm'
import { EditEventForm } from './EditEventForm'
import { DeleteEventButton } from './DeleteEventButton'
import { DeleteRoundButton } from './DeleteRoundButton'
import { ExportEventExcelButton } from '../components/ExportEventExcelButton'

const CATEGORY_LABEL: Record<string, string> = {
  V_TOGETHER: 'V.Together',
  PEOPLE: 'People',
  CULTURE: 'People', // 레거시: 마이그레이션 029 전 데이터
}
const TYPE_LABEL: Record<string, string> = {
  ALWAYS: '상시',
  SEASONAL: '기간제',
}
const METHOD_TYPE_LABEL: Record<string, string> = {
  PHOTO: '사진',
  TEXT: '텍스트',
  VALUE: '숫자/값',
  PEER_SELECT: '동료 선택',
}
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '진행 중',
  PAUSED: '일시정지',
  ENDED: '종료',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const { data, error } = await getEventWithRoundsForAdmin(eventId)

  if (error || !data) {
    notFound()
  }

  const { event, rounds, rewards, verification_methods } = data

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/events"
          className="text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          ← 이벤트 목록
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">{event.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {CATEGORY_LABEL[event.category] ?? event.category}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {TYPE_LABEL[event.type] ?? event.type}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              event.status === 'ACTIVE'
                ? 'bg-green-100 text-green-700'
                : event.status === 'PAUSED'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {STATUS_LABEL[event.status] ?? event.status}
          </span>
        </div>
      </div>

      {/* 소개문구·상태만 수정 가능. 카테고리/보상/인증 방식 변경 시 데이터 깨질 수 있어 제외 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">소개문구 · 상태 수정</h3>
        <p className="mt-1 text-sm text-gray-500">
          제목, 짧은 소개, 상세 소개문구, 대표 이미지 URL, 진행 상태, V.Credit·커피 쿠폰 금액을 수정할 수 있습니다. 카테고리·인증 방식은 변경하지 않습니다.
        </p>
        <div className="mt-4">
          <EditEventForm
            eventId={eventId}
            event={{
              title: event.title,
              description: event.description,
              short_description: event.short_description,
              image_url: event.image_url,
              status: event.status,
            }}
            rewards={rewards}
          />
        </div>
      </div>

      {/* 인증 방식: 조회 전용 (등록 후 변경 불가) */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900">인증 방식</h3>
          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">조회 전용 · 변경 불가</span>
        </div>
        {verification_methods.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">등록된 인증 방식이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {verification_methods.map((m, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                <span className="shrink-0 font-medium text-gray-700">
                  {(m.label && m.label.trim()) ? m.label.trim() : (METHOD_TYPE_LABEL[m.method_type] ?? m.method_type)}
                </span>
                {m.instruction?.trim() && <span className="text-gray-600">— {m.instruction.trim()}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {event.type === 'SEASONAL' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">구간 관리</h3>
          {rounds.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 pr-4 font-medium">구간</th>
                    <th className="pb-2 pr-4 font-medium">참여 기간</th>
                    <th className="pb-2 pr-4 font-medium">인증 마감</th>
                    <th className="pb-2 font-medium text-right">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rounds.map((r) => (
                    <tr key={r.round_id}>
                      <td className="py-2 pr-4 font-medium text-gray-900">{r.round_number}구간</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {formatDate(r.start_date)} ~ {formatDate(r.end_date)}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {r.submission_deadline
                          ? formatDate(r.submission_deadline)
                          : formatDate(r.end_date)}
                      </td>
                      <td className="py-2 text-right">
                        <DeleteRoundButton eventId={eventId} roundId={r.round_id} roundNumber={r.round_number} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">등록된 구간이 없습니다. 아래에서 추가하세요.</p>
          )}
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">해당 월 3구간 자동 생성</p>
            <AddRoundsForm eventId={eventId} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 pt-5">
        <Link href="/admin/events" className="text-sm font-medium text-gray-500 transition hover:text-gray-700">
          ← 이벤트 목록
        </Link>
        <ExportEventExcelButton eventId={eventId} eventTitle={event.title} variant="detail" />
        <DeleteEventButton eventId={eventId} eventTitle={event.title} />
      </div>
    </div>
  )
}
