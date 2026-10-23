import { Link } from 'react-router'

import { CuotaDots } from '@/features/sales/components/cuota-dots'
import { InstallmentSummaryLine } from '@/features/sales/components/installment-summary-line'
import { SaleStatusBadge } from '@/features/sales/components/sale-status-badge'
import { saleCuotaLine } from '@/features/sales/lib/cuota-line'
import { saleDotStatuses } from '@/features/sales/lib/dot-status'
import { isSaleSettled } from '@/features/sales/lib/installment-summary'
import { isSaleVoided } from '@/features/sales/lib/sale-status'
import type { SaleRead } from '@/features/sales/services/types'
import { Skeleton } from '@/features/shared/components/ui/skeleton'
import { cn } from '@/features/shared/lib/cn'
import { formatDate } from '@/features/shared/lib/format-date'
import { formatMoney } from '@/features/shared/lib/format-money'

function voidedNote(sale: SaleRead): string | null {
  const date = sale.voided_at ? formatDate(sale.voided_at) : ''
  const name = sale.voided_by?.name ?? ''
  if (date && name) return `Anulada el ${date} por ${name}`
  if (date) return `Anulada el ${date}`
  if (name) return `Anulada por ${name}`
  return null
}

export function SaleCard({
  sale,
  showClient = false,
  fromClient,
}: {
  sale: SaleRead
  showClient?: boolean
  fromClient?: string
}) {
  const voided = isSaleVoided(sale.status)
  const settled = !voided && isSaleSettled(sale)
  const note = voided ? voidedNote(sale) : null
  return (
    <Link
      to={`/ventas/${sale.id}`}
      state={fromClient ? { fromClient } : undefined}
      className={cn(
        'border-border flex min-h-11 flex-col rounded-md border px-4 py-3 text-left no-underline',
        voided && 'bg-muted',
      )}
    >
      <article className="flex min-h-11 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-heading m-0 font-medium">
            #{sale.sale_number} · {sale.item_description}
          </p>
          <SaleStatusBadge status={sale.status} />
        </div>
        {showClient && sale.client.name ? (
          <p className="m-0 text-sm">{sale.client.name}</p>
        ) : null}
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              'text-heading m-0 font-semibold whitespace-nowrap tabular-nums',
              voided && 'text-text font-medium line-through',
            )}
          >
            {formatMoney(sale.total)}
          </p>
          <p className="m-0 text-sm tabular-nums">{saleCuotaLine(sale)}</p>
        </div>
        <CuotaDots
          count={sale.installments_count}
          statuses={saleDotStatuses(sale)}
          summary={sale.installments_summary}
        />
        <InstallmentSummaryLine
          count={sale.installments_count}
          summary={sale.installments_summary}
          voided={voided}
        />
        <p className="m-0 text-sm">Vendida el {formatDate(sale.created_at)}</p>
        {voided ? (
          note ? <p className="m-0 text-sm">{note}</p> : null
        ) : settled ? null : sale.balance == null ? (
          <p className="m-0">—</p>
        ) : (
          <p className="m-0 text-sm tabular-nums">Saldo {formatMoney(sale.balance)}</p>
        )}
      </article>
    </Link>
  )
}

export function SaleCardSkeleton() {
  return (
    <div
      aria-hidden
      data-testid="sale-card-skeleton"
      className="border-border flex min-h-11 flex-col gap-1.5 rounded-md border px-4 py-3"
    >
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3.5 w-2/5" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-4/5" />
    </div>
  )
}
