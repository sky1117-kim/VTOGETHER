'use client'

import { useState } from 'react'
import type { PersonalRankItem, TeamRankItem } from '@/api/queries/ranking'

interface HonorsSectionProps {
  personalRank: PersonalRankItem[]
  teamRank: TeamRankItem[]
  /** 분기 라벨 (예: 2025 Q1) — 분기별로 리셋되는 랭킹임을 표시 */
  quarterLabel?: string
}

export function HonorsSection({ personalRank, teamRank, quarterLabel }: HonorsSectionProps) {
  const [type, setType] = useState<'PERSONAL' | 'TEAM'>('PERSONAL')
  const data = type === 'PERSONAL' ? personalRank : teamRank

  return (
    <section id="honors">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="section-title flex items-center gap-3 text-gray-900">
            <span className="h-8 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
            V.Honors (명예의 전당)
          </h2>
          {quarterLabel && (
            <p className="text-sm text-gray-500">
              분기별 랭킹 · {quarterLabel} 기준
            </p>
          )}
        </div>
        <div className="flex rounded-xl bg-white/60 p-1 shadow-soft backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setType('PERSONAL')}
            className={`min-h-[44px] min-w-[44px] rounded-md px-4 py-1.5 text-xs font-bold transition ${
              type === 'PERSONAL'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            개인 랭킹
          </button>
          <button
            type="button"
            onClick={() => setType('TEAM')}
            className={`min-h-[44px] min-w-[44px] rounded-md px-4 py-1.5 text-xs font-bold transition ${
              type === 'TEAM'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            팀 랭킹
          </button>
        </div>
      </div>
      <div className="glass card-hover overflow-hidden rounded-2xl shadow-soft overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left">
          <thead className="bg-gray-100/80 text-xs font-medium uppercase tracking-wider text-gray-500">
            <tr>
              <th className="w-14 px-2 py-3 text-center sm:w-16 sm:px-6 sm:py-4">순위</th>
              <th className="min-w-[7rem] px-2 py-3 sm:px-6 sm:py-4">이름 / 소속</th>
              {type === 'TEAM' ? (
                <th className="px-2 py-3 text-center sm:px-6 sm:py-4">기부 인원</th>
              ) : (
                <th className="px-2 py-3 text-center sm:px-6 sm:py-4">등급</th>
              )}
              <th className="whitespace-nowrap px-2 py-3 text-right sm:px-6 sm:py-4">분기 기부액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {data.map((item) => {
              const badgeClass =
                item.rank === 1
                  ? 'bg-yellow-400 text-white'
                  : item.rank === 2
                    ? 'bg-gray-300 text-white'
                    : item.rank === 3
                      ? 'bg-orange-300 text-white'
                      : 'bg-gray-100 text-gray-500'
              const level =
                type === 'PERSONAL' && 'level' in item ? item.level : '-'
              const levelClass =
                level === 'Green Master'
                  ? 'bg-green-100 text-green-700'
                  : level === 'Earth Hero'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-100 text-slate-600'
              return (
                <tr key={item.rank} className="transition-colors hover:bg-white/60">
                  <td className="px-2 py-3 text-center sm:px-6 sm:py-4">
                    <span
                      className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full font-bold text-xs shadow-sm ${badgeClass}`}
                    >
                      {item.rank}
                    </span>
                  </td>
                  <td className="max-w-[11rem] px-2 py-3 text-sm font-bold text-gray-900 sm:max-w-none sm:px-6 sm:py-4 sm:text-base">
                    <span className="break-words">{item.name}</span>
                    {type === 'PERSONAL' && 'dept' in item && item.dept != null && (
                      <span className="mt-0.5 block text-xs font-normal text-gray-400 sm:ml-1 sm:mt-0 sm:inline">
                        {String(item.dept)}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center sm:px-6 sm:py-4">
                    {type === 'TEAM' && 'donatedCount' in item && 'totalCount' in item ? (
                      <span className="text-gray-600">
                        {item.donatedCount}명 / {item.totalCount}명
                      </span>
                    ) : level !== '-' ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${levelClass}`}
                      >
                        {level}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right text-sm font-bold tabular-nums text-gray-800 sm:px-6 sm:py-4 sm:text-base">
                    {item.score.toLocaleString()} C
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
