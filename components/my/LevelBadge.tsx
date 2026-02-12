import { LevelRoadmapModal } from './LevelRoadmapModal'

type Level = 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'

interface LevelBadgeProps {
  level: Level
  size?: 'sm' | 'md' | 'lg'
  totalDonated?: number
}

const levelConfig: Record<
  Level,
  { label: string; emoji: string; color: string; bgColor: string }
> = {
  ECO_KEEPER: {
    label: 'Eco Keeper',
    emoji: '🌱',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  GREEN_MASTER: {
    label: 'Green Master',
    emoji: '🌿',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  EARTH_HERO: {
    label: 'Earth Hero',
    emoji: '🌳',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
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
        className={`inline-flex items-center gap-2 rounded-full font-medium transition-colors hover:opacity-80 ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
      >
        <span>{config.emoji}</span>
        <span>{config.label}</span>
      </button>
    </LevelRoadmapModal>
  )
}
