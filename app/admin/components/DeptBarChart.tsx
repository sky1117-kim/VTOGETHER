'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export type DeptItem = { name: string; count: number }

/** 부서별 사용자 — 가로 막대 차트 (막대가 넓게 보이도록) */
export function DeptBarChart({ data }: { data: DeptItem[] }) {
  if (!data.length) return null

  const maxVal = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="flex flex-col gap-2">
      {/* 차트: 가로 막대 */}
      <div className="h-[80px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 8, left: 12, bottom: 4 }}
          >
            <XAxis type="number" domain={[0, Math.max(maxVal + 1, 5)]} hide />
            <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value: number | undefined) => [(value ?? 0) + '명', '인원']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              cursor={{ fill: '#f1f5f9' }}
            />
            <Bar
              dataKey="count"
              fill="#6366f1"
              radius={[0, 4, 4, 0]}
              barSize={20}
              stroke="#fff"
              strokeWidth={1}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* 데이터 목록 */}
      <div className="space-y-1 border-t border-gray-100 pt-2">
        {data.map((d) => (
          <div key={d.name} className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 text-gray-600">
            <span className="min-w-0 truncate text-xs">{d.name}</span>
            <span className="text-right text-xs font-medium tabular-nums text-gray-900">{d.count}명</span>
          </div>
        ))}
      </div>
    </div>
  )
}
