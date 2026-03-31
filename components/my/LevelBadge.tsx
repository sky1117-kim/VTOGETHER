import { LevelRoadmapModal } from './LevelRoadmapModal'

type Level = 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'

interface LevelBadgeProps {
  level: Level
  size?: 'sm' | 'md' | 'lg'
  totalDonated?: number
}

const levelConfig: Record<
  Level,
  { label: string; emoji: string; color: string; bgColor: string; extraClass?: string }
> = {
  ECO_KEEPER: {
    label: 'Eco Keeper',
    emoji: '🌱',
    color: 'text-[#007a3b]',
    bgColor: 'bg-[#00b859]/15',
  },
  GREEN_MASTER: {
    label: 'Green Master',
    emoji: '🌳',
    color: 'text-white',
    bgColor: 'bg-gradient-to-r from-[#009a4a] via-[#00b859] to-[#34d27a]',
    extraClass: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
  },
  EARTH_HERO: {
    label: 'Earth Hero',
    emoji: '🌍',
    color: 'text-amber-800',
    bgColor: 'bg-amber-100',
  },
}

export function LevelBadge({ level, size = 'md', totalDonated }: LevelBadgeProps) {
  const config = levelConfig[level]
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  }

  return (
    <LevelRoadmapModal level={level} totalDonated={totalDonated}>
      <button
        className={`relative inline-flex overflow-hidden items-center gap-2 rounded-full border border-white/40 font-semibold transition-all hover:scale-[1.02] hover:opacity-95 ${config.bgColor} ${config.color} ${sizeClasses[size]} ${config.extraClass ?? ''}`}
      >
        {level === 'GREEN_MASTER' && (
          <span
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden
            style={{
              background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)',
            }}
          />
        )}
        <span className="relative">{config.emoji}</span>
        <span className="relative">{config.label}</span>
      </button>
    </LevelRoadmapModal>
  )
}
