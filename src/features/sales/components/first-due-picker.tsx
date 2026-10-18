import { useState } from 'react'

import { Button } from '@/features/shared/components/ui/button'
import { TextInput } from '@/features/shared/components/ui/field'
import { formatDueDate } from '@/features/shared/lib/format-due-date'
import { cn } from '@/features/shared/lib/cn'
import {
  addCalendarYears,
  quincenalOptions,
  todayParts,
  toIsoDate,
} from '@/features/sales/lib/calendar'
import { firstDueHint } from '@/features/sales/lib/copy'
import type { Frequency } from '@/features/sales/services/types'

export function FirstDuePicker({
  frequency,
  value,
  onChange,
  error,
  disabled = false,
  hidePicker = false,
}: {
  frequency: Frequency
  value: string
  onChange: (iso: string) => void
  error?: string
  disabled?: boolean
  hidePicker?: boolean
}) {
  const today = todayParts()
  const min = toIsoDate(today)
  const max = toIsoDate(addCalendarYears(today, 1))

  if (hidePicker) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-heading text-sm font-medium">Primera cuota</p>
        <p className="border-border bg-muted text-heading m-0 rounded-md border px-3 py-2.5 tabular-nums">
          {value ? formatDueDate(value) : '—'}
        </p>
      </div>
    )
  }

  if (frequency === 'quincenal') {
    return (
      <QuincenalPicker value={value} onChange={onChange} error={error} disabled={disabled} />
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="first-due" className="text-heading text-sm font-medium">
        Primera cuota
      </label>
      <TextInput
        id="first-due"
        type="date"
        min={min}
        max={max}
        value={value}
        error={error}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault()
        }}
      />
      {error ? (
        <p id="first-due-error" role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : (
        <p className="text-text text-sm">{firstDueHint(frequency)}</p>
      )}
    </div>
  )
}

function QuincenalPicker({
  value,
  onChange,
  error,
  disabled = false,
}: {
  value: string
  onChange: (iso: string) => void
  error?: string
  disabled?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const options = quincenalOptions()
  const visible = expanded ? options : options.slice(0, 4)

  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="text-heading mb-1.5 text-sm font-medium">Primera cuota</legend>
      <p className="text-text mb-1.5 text-sm">{firstDueHint('quincenal')}</p>
      <div role="radiogroup" aria-label="Primera cuota" className="flex flex-col gap-2">
        {visible.map((option, index) => {
          const selected = value ? option.iso === value : index === 0
          const kindLabel = option.kind === 'day15' ? 'Día 15' : 'Fin de mes'
          const hint = index === 0 ? `Sugerida · ${option.kind === 'day15' ? 'día 15' : 'fin de mes'}` : kindLabel
          return (
            <label
              key={option.iso}
              className={cn(
                'flex min-h-12 items-center justify-between rounded-md border px-3',
                selected
                  ? 'border-accent bg-accent-bg border-2'
                  : 'border-border',
              )}
            >
              <span className="text-heading flex items-center gap-2.5">
                <input
                  type="radio"
                  name="first-due-quincenal"
                  className="sr-only"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onChange(option.iso)}
                />
                <span
                  aria-hidden
                  className={cn(
                    'inline-block size-5 rounded-full border-2',
                    selected ? 'border-accent border-6' : 'border-border',
                  )}
                />
                {formatDueDate(option.iso)}
              </span>
              <span className="text-text text-[13px]">{hint}</span>
            </label>
          )
        })}
      </div>
      {options.length > 4 ? (
        <Button
          variant="ghost"
          className="w-full"
          disabled={disabled}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Ver menos fechas' : 'Ver más fechas'}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
