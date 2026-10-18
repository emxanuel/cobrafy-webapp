import { Link } from 'react-router'

import { CuotaDots } from '@/features/sales/components/cuota-dots'
import { SaleStatusBadge } from '@/features/sales/components/sale-status-badge'
import { frequencyAdjective } from '@/features/sales/lib/copy'
import { saleDotStatuses } from '@/features/sales/lib/dot-status'
import { isSaleVoided } from '@/features/sales/lib/sale-status'
import type { SaleRead } from '@/features/sales/services/types'
import { Skeleton } from '@/features/shared/components/ui/skeleton'
import { cn } from '@/features/shared/lib/cn'
import { formatDate } from '@/features/shared/lib/format-date'
import { formatMoney } from '@/features/shared/lib/format-money'

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
  const cuotaLine = `${sale.installments_count} ${frequencyAdjective(sale.frequency, sale.installments_count)}`
  return (
    <Link
      to={`/ventas/${sale.id}`}
      state={fromClient ? { fromClient } : undefined}
      className={cn(
        'border-border flex min-h-11 flex-col gap-1.5 rounded-md border px-4 py-3 text-left no-underline',
        voided && 'bg-muted',
      )}
    >
      <article>
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
          <p className={cn('text-heading m-0 font-semibold tabular-nums', voided && 'text-text line-through font-medium')}>
            {formatMoney(sale.total)}
          </p>
          <p className="m-0 text-sm tabular-nums">{cuotaLine}</p>
        </div>
        <CuotaDots count={sale.installments_count} statuses={saleDotStatuses(sale)} />
        <p className="m-0 text-sm">Vendida el {formatDate(sale.created_at)}</p>
        {voided ? (
          <p className="m-0 text-sm">
            Anulada el {formatDate(sale.voided_at ?? sale.created_at)}
            {sale.voided_by?.name ? ` por ${sale.voided_by.name}` : ''}
          </p>
        ) : sale.balance == null ? (
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
      className="border-border flex min-h-11 flex-col gap-2 rounded-md border px-4 py-3"
    >
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3.5 w-2/5" />
      <Skeleton className="h-3.5 w-full" />
    </div>
  )
}
