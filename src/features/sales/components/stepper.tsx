import { Button } from '@/features/shared/components/ui/button'
import { TextInput } from '@/features/shared/components/ui/field'

function digitsToInt(raw: string): number {
  let n = 0
  let saw = false
  for (const ch of raw) {
    if (ch < '0' || ch > '9') continue
    saw = true
    n = n * 10 + (ch.charCodeAt(0) - 48)
  }
  return saw ? n : 0
}

export function Stepper({
  id,
  value,
  min = 1,
  max = 24,
  onChange,
  error,
  disabled = false,
  hideButtons = false,
}: {
  id: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  error?: string
  disabled?: boolean
  hideButtons?: boolean
}) {
  function clamp(next: number) {
    if (next < min) return min
    if (next > max) return max
    return next
  }

  if (hideButtons) {
    return (
      <TextInput
        id={id}
        inputMode="numeric"
        error={error}
        value={String(value)}
        disabled
        readOnly
        className="text-center tabular-nums"
      />
    )
  }

  return (
    <div className="grid grid-cols-[44px_1fr_44px] gap-2">
      <Button
        variant="outline"
        className="min-h-11 px-0 text-xl"
        aria-label="Quitar una cuota"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </Button>
      <TextInput
        id={id}
        inputMode="numeric"
        error={error}
        value={String(value)}
        disabled={disabled}
        className="text-center tabular-nums"
        onChange={(event) => {
          const next = digitsToInt(event.target.value)
          if (next === 0) return
          onChange(clamp(next))
        }}
      />
      <Button
        variant="outline"
        className="min-h-11 px-0 text-xl"
        aria-label="Agregar una cuota"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </Button>
    </div>
  )
}
