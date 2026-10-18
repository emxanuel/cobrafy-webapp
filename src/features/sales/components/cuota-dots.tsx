import { cn } from '@/features/shared/lib/cn'

export type DotStatus = 'pending' | 'paid' | 'late' | 'partial' | 'cancelled'

function statusCountLabel(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`
}

const MAX_DOTS = 12

export function CuotaDots({
  count,
  statuses,
  dim = false,
}: {
  count: number
  statuses?: DotStatus[]
  dim?: boolean
}) {
  const visible = count > MAX_DOTS ? MAX_DOTS : count
  const extra = count > MAX_DOTS ? count - MAX_DOTS : 0
  const list = statuses ?? []
  const paid = list.filter((item) => item === 'paid').length
  const late = list.filter((item) => item === 'late').length
  const partial = list.filter((item) => item === 'partial').length
  const cancelled = list.filter((item) => item === 'cancelled').length
  const allCancelled = count > 0 && cancelled === count
  const pending = count - paid - late - partial - cancelled
  const parts = [
    paid ? statusCountLabel(paid, 'pagada', 'pagadas') : null,
    late ? statusCountLabel(late, 'atrasada', 'atrasadas') : null,
    partial ? statusCountLabel(partial, 'parcial', 'parciales') : null,
    pending ? statusCountLabel(pending, 'pendiente', 'pendientes') : null,
  ].filter(Boolean)
  const label = allCancelled
    ? `${count} cuotas canceladas`
    : `${count} cuotas: ${parts.join(', ')}`

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="img" aria-label={label}>
      {Array.from({ length: visible }, (_, index) => {
        const status = statuses?.[index] ?? 'pending'
        return (
          <span
            key={index}
            className={cn(
              'inline-block size-3.5 rounded-full border-2',
              status === 'paid' && 'border-success bg-success',
              status === 'late' && 'border-danger bg-danger',
              (status === 'pending' || status === 'partial') && 'border-heading opacity-55',
              status === 'cancelled' && 'cuota-dot-cancelled',
              dim && 'opacity-25',
            )}
          />
        )
      })}
      {extra > 0 ? <span className="text-text text-xs">+{extra}</span> : null}
    </div>
  )
}
