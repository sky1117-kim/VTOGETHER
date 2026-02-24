'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

/** MAU vs 비활성 사용자 — 도넛만 표시, 범례 없음 (아래 데이터 목록이 대체) */
export function MauDonutChart({ mau, total }: { mau: number; total: number }) {
  if (total === 0) return null
  const inactive = Math.max(0, total - mau)
  const data = [
    { name: '최근 30일 접속', value: mau, fill: '#6d28d9' },
    { name: '미접속', value: inactive, fill: '#e2e8f0' },
  ].filter((d) => d.value > 0)
  if (!data.length) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-[90px] w-full items-center justify-center">
        <ResponsiveContainer width="100%" height={90}>
          <PieChart margin={0}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={24}
              outerRadius={36}
              paddingAngle={2}
              dataKey="value"
              stroke="#fff"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={data[i].fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value}명 (${total ? ((value / total) * 100).toFixed(1) : 0}%)`,
                name,
              ]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* 색상 범례 — 도형·텍스트 세로 중앙 정렬 */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] leading-none">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 self-center rounded-sm" style={{ backgroundColor: d.fill }} />
            <span className="leading-none text-gray-600">{d.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
