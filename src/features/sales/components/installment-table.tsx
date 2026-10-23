import { useState } from 'react'

import { CuotaDots } from '@/features/sales/components/cuota-dots'
import { InstallmentStatusLabel } from '@/features/sales/components/installment-status-label'
import { InstallmentSummaryLine } from '@/features/sales/components/installment-summary-line'
import { installmentStatusKind } from '@/features/sales/lib/installment-status'
import { saleDotStatuses } from '@/features/sales/lib/dot-status'
import { isSaleVoided } from '@/features/sales/lib/sale-status'
import type { SaleDetail } from '@/features/sales/services/types'
import { Button } from '@/features/shared/components/ui/button'
import { cn } from '@/features/shared/lib/cn'
import { formatDueDate } from '@/features/shared/lib/format-due-date'
import { formatMoney } from '@/features/shared/lib/format-money'

const PREVIEW_ROWS = 6

function installmentHeaderSummary(sale: SaleDetail): string {
  const n = sale.installments.length || sale.installments_count
  const paid = sale.installments.filter((row) => installmentStatusKind(row.status) === 'paid').length
  if (paid > 0) return `${paid} de ${n} pagadas`
  const pending = sale.installments.filter(
    (row) => installmentStatusKind(row.status) === 'pending',
  ).length
  const shown = pending > 0 ? pending : n
  return shown === 1 ? '1 pendiente' : `${shown} pendientes`
}

export function InstallmentTable({ sale }: { sale: SaleDetail }) {
  const [expanded, setExpanded] = useState(false)
  const voided = isSaleVoided(sale.status)
  const rows = expanded ? sale.installments : sale.installments.slice(0, PREVIEW_ROWS)
  const summary = voided ? (
    <InstallmentSummaryLine
      voided
      count={sale.installments_count}
      summary={sale.installments_summary}
    />
  ) : sale.installments_summary ? (
    <InstallmentSummaryLine
      count={sale.installments_count}
      summary={sale.installments_summary}
    />
  ) : (
    installmentHeaderSummary(sale)
  )

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-lg">Cuotas</h2>
        <span className="text-sm">{summary}</span>
      </div>
      <CuotaDots
        count={sale.installments_count}
        statuses={saleDotStatuses(sale)}
        summary={sale.installments_summary}
      />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-text border-border border-b p-1 text-left text-xs font-medium tracking-wide uppercase">
              #
            </th>
            <th className="text-text border-border border-b p-1 text-left text-xs font-medium tracking-wide uppercase">
              Vence
            </th>
            <th className="text-text border-border border-b p-1 text-right text-xs font-medium tracking-wide uppercase">
              Monto
            </th>
            <th className="text-text border-border border-b p-1 text-left text-xs font-medium tracking-wide uppercase">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cancelled = installmentStatusKind(row.status) === 'cancelled' || voided
            return (
              <tr key={row.number} className={cancelled ? 'text-text' : 'text-heading'}>
                <td className="border-border border-b px-1 py-2 tabular-nums">{row.number}</td>
                <td className="border-border border-b px-1 py-2 tabular-nums">
                  {formatDueDate(row.due_date)}
                </td>
                <td
                  className={cn(
                    'border-border border-b px-1 py-2 text-right tabular-nums',
                    cancelled && 'line-through',
                  )}
                >
                  {formatMoney(row.amount)}
                </td>
                <td className="border-border border-b px-1 py-2 whitespace-nowrap">
                  <InstallmentStatusLabel
                    status={cancelled ? 'cancelled' : row.status}
                    hasPayment={cancelled ? undefined : row.has_payment}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!expanded && sale.installments_count > PREVIEW_ROWS ? (
        <Button variant="ghost" className="min-h-11 w-full" onClick={() => setExpanded(true)}>
          Ver las {sale.installments_count} cuotas
        </Button>
      ) : null}
    </section>
  )
}
