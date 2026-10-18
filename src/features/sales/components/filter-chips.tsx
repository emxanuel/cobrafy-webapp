import { cn } from '@/features/shared/lib/cn'

export type SalesStatusFilter = '' | 'active' | 'voided'

const OPTIONS: Array<{ value: SalesStatusFilter; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'voided', label: 'Anuladas' },
]

export function FilterChips({
  value,
  onChange,
}: {
  value: SalesStatusFilter
  onChange: (value: SalesStatusFilter) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Estado">
      {OPTIONS.map((option) => {
        const pressed = value === option.value
        return (
          <button
            key={option.label}
            type="button"
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border px-3.5 whitespace-nowrap',
              pressed
                ? 'border-accent bg-accent-bg text-accent border-2'
                : 'border-border bg-bg text-heading',
            )}
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
