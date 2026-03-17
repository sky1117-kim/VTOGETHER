'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export type LevelItem = { name: string; value: number }

const LEVEL_COLORS: Record<string, string> = {
  'Eco Keeper': '#64748b',
  'Green Master': '#059669',
  'Earth Hero': '#6d28d9',
}

/** 등급별 사용자 — 도넛만 표시, 범례 없음 (아래 목록이 대체) */
export function UserLevelPie({ data }: { data: LevelItem[] }) {
  if (!data.length) return null

  const total = data.reduce((s, d) => s + d.value, 0)
  const chartData = data
  const hasChart = total > 0

  return (
    <div className="flex flex-col gap-2">
      {/* 차트 */}
      <div className="flex h-[90px] w-full items-center justify-center">
        {hasChart ? (
          <ResponsiveContainer width="100%" height={90}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
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
                {chartData.map((d) => (
                  <Cell key={d.name} fill={LEVEL_COLORS[d.name] ?? '#64748b'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | undefined, name?: string) => [
                  `${value ?? 0}명${total > 0 ? ` (${(((value ?? 0) / total) * 100).toFixed(1)}%)` : ''}`,
                  name ?? '',
                ]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[70px] w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 text-xs text-gray-500">
            데이터 없음
          </div>
        )}
      </div>
      {/* 색상 범례 — 도형·텍스트 세로 중앙 정렬 */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] leading-none">
        {(['Eco Keeper', 'Green Master', 'Earth Hero'] as const).map((name) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 self-center rounded-sm" style={{ backgroundColor: LEVEL_COLORS[name] ?? '#64748b' }} />
            <span className="leading-none text-gray-600">{name}</span>
          </span>
        ))}
      </div>
      {/* 데이터 목록 */}
      <div className="space-y-1 border-t border-gray-100 pt-2">
        {data.map((d) => (
          <div key={d.name} className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 text-gray-600">
            <span className="min-w-0 truncate text-xs">{d.name}</span>
            <span className="whitespace-nowrap text-right text-xs font-medium tabular-nums text-gray-900">{d.value}명</span>
          </div>
        ))}
      </div>
    </div>
  )
}
