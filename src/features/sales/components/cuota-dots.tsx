import { type DotStatus } from '@/features/sales/lib/dot-status'
import { dotsAriaLabel } from '@/features/sales/lib/installment-summary'
import type { InstallmentsSummary } from '@/features/sales/services/types'
import { cn } from '@/features/shared/lib/cn'

export type { DotStatus }

const MAX_DOTS = 12

function dotClass(status: DotStatus, dim: boolean): string {
  return cn(
    'inline-block size-3.5 rounded-full border-2',
    status === 'paid' && 'border-success bg-success',
    status === 'late' && 'border-danger bg-danger',
    status === 'partial' && 'cuota-dot-partial',
    status === 'late-partial' && 'cuota-dot-late-partial',
    status === 'pending' && 'border-heading opacity-55',
    status === 'pending-paid' && 'cuota-dot-pending-paid',
    status === 'cancelled' && 'cuota-dot-cancelled',
    dim && 'opacity-25',
  )
}

export function CuotaDots({
  count,
  statuses,
  summary,
  dim = false,
}: {
  count: number
  statuses?: DotStatus[]
  summary?: InstallmentsSummary
  dim?: boolean
}) {
  const visible = count > MAX_DOTS ? MAX_DOTS : count
  const extra = count > MAX_DOTS ? count - MAX_DOTS : 0
  const list = statuses ?? []
  const label = dotsAriaLabel({ count, summary, statuses: list })

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="img" aria-label={label}>
      {Array.from({ length: visible }, (_, index) => {
        const status = statuses?.[index] ?? 'pending'
        return <span key={index} className={dotClass(status, dim)} />
      })}
      {extra > 0 ? <span className="text-text text-xs">+{extra}</span> : null}
    </div>
  )
}
