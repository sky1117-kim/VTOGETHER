'use client'

import { useRouter } from 'next/navigation'
import type { RewardFulfillmentFilter } from '@/api/actions/admin'

interface EventFilterSelectProps {
  events: { event_id: string; title: string }[]
  currentEventId: string | null
  currentFilter: RewardFulfillmentFilter
}

export function EventFilterSelect({
  events,
  currentEventId,
  currentFilter,
}: EventFilterSelectProps) {
  const router = useRouter()

  const buildUrl = (eventId: string | null, filter: RewardFulfillmentFilter) => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('filter', filter)
    if (eventId) params.set('eventId', eventId)
    const qs = params.toString()
    return `/admin/reward-fulfillment${qs ? `?${qs}` : ''}`
  }

  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null
    router.push(buildUrl(value, currentFilter))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="event-filter" className="text-sm font-medium text-gray-600">
        이벤트:
      </label>
      <select
        id="event-filter"
        value={currentEventId ?? ''}
        onChange={handleEventChange}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"
      >
        <option value="">전체 이벤트</option>
        {events.map((e) => (
          <option key={e.event_id} value={e.event_id}>
            {e.title}
          </option>
        ))}
      </select>
    </div>
  )
}
