interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: string
}

export function StatsCard({ title, value, subtitle, icon }: StatsCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-black dark:text-zinc-50">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-4xl opacity-50">{icon}</div>
        )}
      </div>
    </div>
  )
}
