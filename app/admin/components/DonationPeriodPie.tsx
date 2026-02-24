'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

type PeriodData = { today: number; thisWeek: number; thisMonth: number }

const PERIOD_COLORS = ['#10b981', '#0ea5e9', '#64748b']

function formatPts(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만 P'
  return n.toLocaleString() + ' P'
}

/** 기간별 기부 — 도넛만 표시, 범례 없음 (아래 목록이 대체) */
export function DonationPeriodPie({ data }: { data: PeriodData }) {
  const { today, thisWeek, thisMonth } = data
  if (thisMonth === 0) return null

  const todayOnly = today
  const weekExcludeToday = Math.max(0, thisWeek - today)
  const monthExcludeWeek = Math.max(0, thisMonth - thisWeek)

  const chartData = [
    { name: '오늘', value: todayOnly },
    { name: '이번 주', value: weekExcludeToday },
    { name: '이번 달', value: monthExcludeWeek },
  ].filter((d) => d.value > 0)

  const periodLabels = ['오늘', '이번 주', '이번 달'] as const
  const periodColors = PERIOD_COLORS

  return (
    <div className="flex flex-col gap-2">
      {/* 차트 */}
      <div className="flex h-[90px] w-full items-center justify-center">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={90}>
            <PieChart margin={0}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={36}
                paddingAngle={2}
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={PERIOD_COLORS[i % PERIOD_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [value.toLocaleString() + ' P', '기부액']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[70px] w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 text-xs text-gray-500">
            기부 내역 없음
          </div>
        )}
      </div>
      {/* 색상 범례 — 도형·텍스트 세로 중앙 정렬 */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] leading-none">
        {periodLabels.map((label, i) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 self-center rounded-sm" style={{ backgroundColor: periodColors[i] }} />
            <span className="leading-none text-gray-600">{label}</span>
          </span>
        ))}
      </div>
      {/* 데이터 목록 */}
      <div className="space-y-1 border-t border-gray-100 pt-2">
        <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 text-gray-600">
          <span className="text-xs">오늘</span>
          <span className="whitespace-nowrap text-right text-xs font-medium tabular-nums text-gray-900">{formatPts(today)}</span>
        </div>
        <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 text-gray-600">
          <span className="text-xs">이번 주</span>
          <span className="whitespace-nowrap text-right text-xs font-medium tabular-nums text-gray-900">{formatPts(thisWeek)}</span>
        </div>
        <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 text-gray-600">
          <span className="text-xs">이번 달</span>
          <span className="whitespace-nowrap text-right text-xs font-medium tabular-nums text-gray-900">{formatPts(thisMonth)}</span>
        </div>
      </div>
    </div>
  )
}
