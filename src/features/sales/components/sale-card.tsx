import { SaleStatusBadge } from '@/features/sales/components/sale-status-badge'
import { isSaleVoided } from '@/features/sales/lib/sale-status'
import type { SaleRead } from '@/features/sales/services/types'
import { Skeleton } from '@/features/shared/components/ui/skeleton'
import { cn } from '@/features/shared/lib/cn'
import { formatDate } from '@/features/shared/lib/format-date'
import { formatMoney } from '@/features/shared/lib/format-money'

export function SaleCard({ sale }: { sale: SaleRead }) {
  const voided = isSaleVoided(sale.status)
  return (
    <article
      className={cn(
        'border-border flex min-h-11 flex-col gap-1 rounded-md border px-4 py-3 text-left',
        voided && 'bg-muted',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-heading m-0 font-medium">
          #{sale.sale_number} · {sale.item_description}
        </p>
        <SaleStatusBadge status={sale.status} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn('text-heading m-0 tabular-nums', voided && 'line-through')}>
          {formatMoney(sale.total)}
        </p>
        {voided ? null : <p className="m-0 tabular-nums">{formatMoney(sale.balance)}</p>}
      </div>
      <p className="m-0 text-sm">Vendida el {formatDate(sale.created_at)}</p>
    </article>
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
