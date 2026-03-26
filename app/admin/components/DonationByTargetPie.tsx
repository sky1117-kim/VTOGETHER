'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { TARGET_CHART_COLORS } from '@/constants/donationTargets'

export type DonationByTargetItem = { name: string; value: number }

const DEFAULT_COLOR = '#94a3b8'

function getTargetColor(name: string) {
  return TARGET_CHART_COLORS[name] ?? DEFAULT_COLOR
}

/** 기부처별 기부 — 기부처 고유 색상 사용, 전체 기부처 범례 표시 */
export function DonationByTargetPie({ data }: { data: DonationByTargetItem[] }) {
  if (!data.length) return null

  const total = data.reduce((s, d) => s + d.value, 0)
  const chartData = data.filter((d) => d.value > 0)
  const hasChart = chartData.length > 0 && total > 0

  return (
    <div className="flex flex-col gap-2">
      {/* 차트 */}
      <div className="flex h-[90px] w-full items-center justify-center">
        {hasChart ? (
          <ResponsiveContainer width="100%" height={90}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={chartData.map((d) => ({ ...d, name: d.name }))}
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={36}
                paddingAngle={2}
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
              >
                {chartData.map((d) => (
                  <Cell key={d.name} fill={getTargetColor(d.name)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | undefined) => [`${(value ?? 0).toLocaleString()} C`, '기부액']}
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
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] leading-none">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 self-center rounded-sm" style={{ backgroundColor: getTargetColor(d.name) }} />
            <span className="leading-none text-gray-600">{d.name}</span>
          </span>
        ))}
      </div>
      {/* 데이터 목록 */}
      <div className="space-y-1 border-t border-gray-100 pt-2">
        {data.map((d, i) => (
          <div key={`${d.name}-${i}`} className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 text-gray-600">
            <span className="min-w-0 truncate text-xs">{d.name}</span>
            <span className="whitespace-nowrap text-right text-xs font-medium tabular-nums text-gray-900">
              {d.value.toLocaleString()} C
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
