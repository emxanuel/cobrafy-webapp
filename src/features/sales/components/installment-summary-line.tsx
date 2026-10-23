import { isSaleSettled, statusCountLabel, summaryLineParts } from '@/features/sales/lib/installment-summary'
import type { InstallmentsSummary } from '@/features/sales/services/types'
import { cn } from '@/features/shared/lib/cn'

export function InstallmentSummaryLine({
  count,
  summary,
  voided = false,
}: {
  count: number
  summary?: InstallmentsSummary
  voided?: boolean
}) {
  if (voided) {
    const n = summary?.cancelled ?? count
    return (
      <p className="m-0 text-sm tabular-nums">
        <span aria-hidden>⊘</span> {statusCountLabel(n, 'cancelada', 'canceladas')}
      </p>
    )
  }
  if (!summary) return null
  if (isSaleSettled({ installments_count: count, installments_summary: summary })) {
    return (
      <p className="text-success m-0 text-sm tabular-nums">
        <span aria-hidden>✓</span> Saldada · {statusCountLabel(summary.paid, 'pagada', 'pagadas')}
      </p>
    )
  }
  const parts = summaryLineParts(summary)
  if (parts.length === 0) return null
  return (
    <p className="m-0 text-sm tabular-nums">
      {parts.map((part, index) => (
        <span key={part.key}>
          {index > 0 ? ' · ' : null}
          <span className={cn(part.className)}>
            <span aria-hidden>{part.icon}</span> {part.label}
          </span>
        </span>
      ))}
    </p>
  )
}
