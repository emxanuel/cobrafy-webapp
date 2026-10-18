import { Badge } from '@/features/shared/components/ui/badge'
import { Skeleton } from '@/features/shared/components/ui/skeleton'
import { formatDueDate } from '@/features/shared/lib/format-due-date'
import { formatMoney } from '@/features/shared/lib/format-money'
import { cn } from '@/features/shared/lib/cn'
import { CuotaDots } from '@/features/sales/components/cuota-dots'
import { surchargeLabel } from '@/features/sales/lib/copy'
import type { SimulateSaleResponse } from '@/features/sales/services/types'

export function PlanCard({
  state,
  plan,
  dim = false,
}: {
  state: 'idle' | 'calculating' | 'result' | 'field-error'
  plan?: SimulateSaleResponse | null
  dim?: boolean
}) {
  if (state === 'idle') {
    return (
      <section className="bg-muted rounded-md px-4 py-4" aria-live="polite">
        <p className="text-heading m-0 text-sm font-medium">Plan de pago</p>
        <p className="text-heading m-0 mt-1">Escribe el precio y el plazo para ver las cuotas.</p>
        <div className="mt-2">
          <CuotaDots count={6} dim />
        </div>
      </section>
    )
  }

  if (state === 'field-error') {
    return (
      <section className="bg-muted rounded-md px-4 py-4" aria-live="polite">
        <p className="text-heading m-0">Corrige el campo marcado para ver las cuotas.</p>
      </section>
    )
  }

  if (state === 'calculating' && !plan) {
    return (
      <section className="border-border rounded-md border px-4 py-4" aria-busy="true">
        <div className="flex items-center justify-between">
          <p className="text-heading m-0 text-sm font-medium">Plan de pago</p>
          <Badge tone="accent">Calculando…</Badge>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
        </div>
      </section>
    )
  }

  if (!plan) return null

  const last = plan.installments.at(-1)
  const lastDiffers = Boolean(last && last.amount !== plan.installment_amount)

  return (
    <section
      className={cn('border-border rounded-md border px-4 py-4', dim && 'opacity-45')}
      aria-live="polite"
      aria-busy={state === 'calculating'}
    >
      <div className="flex items-center justify-between">
        <p className="text-heading m-0 text-sm font-medium">Plan de pago</p>
        {state === 'calculating' ? (
          <Badge tone="accent">Calculando…</Badge>
        ) : (
          <Badge tone="success">✓ Actualizado</Badge>
        )}
      </div>
      <p className="mt-1 mb-0 text-sm">{plan.installment_count} cuotas de</p>
      <p className="text-heading m-0 text-[30px] leading-tight font-semibold tabular-nums">
        {formatMoney(plan.installment_amount)}
      </p>
      {lastDiffers && last ? (
        <p className="m-0 text-sm">
          La última cuota es de {formatMoney(last.amount)} (ajuste de centavos).
        </p>
      ) : null}
      <div className="mt-2">
        <CuotaDots count={plan.installment_count} />
      </div>
      <div className="mt-1.5">
        <div className="border-border flex justify-between border-b border-dashed py-1.5 text-[15px]">
          <span>Saldo financiado</span>
          <b className="text-heading font-medium tabular-nums">{formatMoney(plan.financed_balance)}</b>
        </div>
        <div className="border-border flex justify-between border-b border-dashed py-1.5 text-[15px]">
          <span>{surchargeLabel(plan)}</span>
          <b className="text-heading font-medium tabular-nums">{formatMoney(plan.surcharge)}</b>
        </div>
        <div className="flex justify-between py-1.5 text-[15px]">
          <span>Total a pagar</span>
          <b className="text-heading font-bold tabular-nums">{formatMoney(plan.total)}</b>
        </div>
      </div>
      <details className="mt-1">
        <summary className="text-accent flex min-h-11 cursor-pointer items-center">
          Ver calendario ({plan.installment_count} cuotas)
        </summary>
        <table className="mt-1 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-text border-border border-b px-1 py-1.5 text-left text-xs font-medium tracking-wide uppercase">
                #
              </th>
              <th className="text-text border-border border-b px-1 py-1.5 text-left text-xs font-medium tracking-wide uppercase">
                Vence
              </th>
              <th className="text-text border-border border-b px-1 py-1.5 text-right text-xs font-medium tracking-wide uppercase">
                Monto
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.installments.map((row) => {
              const adjusted = lastDiffers && row.number === last?.number
              return (
                <tr key={row.number} className={adjusted ? 'bg-accent-bg' : undefined}>
                  <td className="border-border text-heading border-b px-1 py-2 tabular-nums">
                    {row.number}
                  </td>
                  <td className="border-border text-heading border-b px-1 py-2 tabular-nums">
                    {formatDueDate(row.due_date)}
                  </td>
                  <td className="border-border text-heading border-b px-1 py-2 text-right tabular-nums">
                    {formatMoney(row.amount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </details>
    </section>
  )
}
