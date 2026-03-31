import Link from 'next/link'
import { getEventsForAdmin } from '@/api/actions/admin/events'
import { EventRowActions } from './EventRowActions'
import { AdminPageHeader } from '../components/AdminPageHeader'

const CATEGORY_LABEL: Record<string, string> = {
  CULTURE: 'V.Together',
  PEOPLE: 'People',
  V_TOGETHER: 'V.Together', // 레거시: 마이그레이션 032 전 데이터
}
const TYPE_LABEL: Record<string, string> = {
  ALWAYS: '상시',
  SEASONAL: '기간제',
}
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '진행 중',
  PAUSED: '일시정지',
  ENDED: '종료',
}

function formatRewardLabel(event: {
  reward_type: string | null
  reward_amount: number | null
  reward_preview_kind?: 'V_CREDIT' | 'V_MEDAL' | null
  reward_preview_amount?: number | null
}) {
  if (event.reward_preview_kind && event.reward_preview_amount != null) {
    return event.reward_preview_kind === 'V_MEDAL'
      ? `${event.reward_preview_amount} 메달`
      : `${event.reward_preview_amount} 크레딧`
  }

  if (event.reward_type === 'V_CREDIT' || event.reward_type === 'POINTS') {
    return event.reward_amount != null ? `${event.reward_amount} 크레딧` : '크레딧'
  }
  if (event.reward_type === 'V_MEDAL') {
    return event.reward_amount != null ? `${event.reward_amount} 메달` : '메달'
  }

  return '보상 미설정'
}

export default async function AdminEventsPage() {
  const { data: events, error } = await getEventsForAdmin()
  const list = events ?? []

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="이벤트 & 챌린지 관리"
        description="이벤트를 등록하고 관리합니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '이벤트' }]}
        actions={
          <>
            <Link
              href="/admin/verifications"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              인증 심사
            </Link>
            <Link
              href="/admin/reward-fulfillment"
              className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-50"
            >
              쿠폰/굿즈 발송
            </Link>
            <Link
              href="/admin/events/new"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 btn-press"
            >
              + 새 이벤트 등록
            </Link>
          </>
        }
      />

      <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900">
        <strong className="font-semibold">건강 챌린지</strong>는{' '}
        <Link href="/admin/events/new" className="font-medium underline underline-offset-2">
          새 이벤트 등록
        </Link>
        에서 People 카테고리와 함께 시즌을 열 수 있습니다. 활동 심사·정산은{' '}
        <Link href="/admin/verifications" className="font-medium underline underline-offset-2">
          인증 심사
        </Link>
        에서 일반 이벤트와 같이 처리합니다.
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {list.length === 0 && !error ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">등록된 이벤트가 없습니다.</p>
          <Link
            href="/admin/events/new"
            className="mt-4 inline-block text-sm font-semibold text-green-600 hover:text-green-700"
          >
            첫 이벤트 등록하기 →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                  제목
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                  카테고리
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                  타입
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                  보상
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                  등록일
                </th>
                <th className="pl-2 pr-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                  동작
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {list.map((e) => (
                <tr key={e.event_id} className="transition hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/events/${e.event_id}`}
                      className="font-medium text-gray-900 underline-offset-2 hover:underline"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {CATEGORY_LABEL[e.category] ?? e.category}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {TYPE_LABEL[e.type] ?? e.type}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {formatRewardLabel(e as {
                      reward_type: string | null
                      reward_amount: number | null
                      reward_preview_kind?: 'V_CREDIT' | 'V_MEDAL' | null
                      reward_preview_amount?: number | null
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        e.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : e.status === 'PAUSED'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                  <td className="px-4 pr-2 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="pl-2 pr-4 py-3 align-middle">
                    <EventRowActions eventId={e.event_id} eventTitle={e.title} status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
