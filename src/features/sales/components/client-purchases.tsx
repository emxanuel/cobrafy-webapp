import { Link } from 'react-router'

import type { Role } from '@/features/auth/services/types'
import { SaleCard, SaleCardSkeleton } from '@/features/sales/components/sale-card'
import { useClientSales } from '@/features/sales/hooks/use-sales-queries'
import { purchaseCounterLabel } from '@/features/sales/lib/sale-status'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button, buttonVariants } from '@/features/shared/components/ui/button'
import { EmptyState } from '@/features/shared/components/ui/empty-state'
import { isApiError } from '@/features/shared/lib/api-error'
import { canSell } from '@/features/shared/lib/roles'

const PREVIEW_COUNT = 3

export function ClientPurchases({
  clientId,
  role,
  blocked = false,
  preview = false,
}: {
  clientId: string
  role: Role | null
  blocked?: boolean
  preview?: boolean
}) {
  const sales = useClientSales(clientId)
  const items = sales.data ?? []
  const shown = preview ? items.slice(0, PREVIEW_COUNT) : items
  const allowSell = canSell(role) && !blocked

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-heading m-0 text-lg">Compras</h2>
        {!preview && allowSell ? (
          <Link
            to={`/clientes/${clientId}/ventas/nueva`}
            className={`${buttonVariants({ variant: 'primary' })} self-start no-underline`}
          >
            ＋ Nueva venta
          </Link>
        ) : null}
        {!preview && canSell(role) && blocked ? (
          <Button disabled>＋ Nueva venta</Button>
        ) : null}
      </div>

      {!sales.isLoading && !sales.isError && items.length > 0 && !preview ? (
        <p className="m-0 text-sm">{purchaseCounterLabel(items)}</p>
      ) : null}

      {sales.isError ? (
        <Alert
          icon="✕"
          title="No se pudieron cargar las compras."
          action={
            <Button variant="outline" onClick={() => void sales.refetch()}>
              Reintentar
            </Button>
          }
        >
          {isApiError(sales.error) && sales.error.status === 403
            ? 'No tienes permiso para ver las compras de este cliente.'
            : 'Revisa tu conexión e inténtalo de nuevo.'}
        </Alert>
      ) : null}

      {sales.isLoading ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Cargando…</span>
          <SaleCardSkeleton />
          <SaleCardSkeleton />
        </div>
      ) : null}

      {!sales.isLoading && !sales.isError && items.length === 0 ? (
        <EmptyState
          className="py-4"
          action={
            allowSell ? (
              <Link
                to={`/clientes/${clientId}/ventas/nueva`}
                className={`${buttonVariants({ variant: 'link' })} min-h-11 no-underline`}
              >
                Registrar la primera venta
              </Link>
            ) : undefined
          }
        >
          Aún no hay compras registradas para este cliente.
        </EmptyState>
      ) : null}

      {!sales.isLoading && !sales.isError && shown.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((sale) => (
            <li key={sale.id}>
              <SaleCard sale={sale} fromClient={clientId} />
            </li>
          ))}
        </ul>
      ) : null}

      {preview && !sales.isLoading && !sales.isError && items.length > 0 ? (
        <Link
          to={`/clientes/${clientId}/historial`}
          className={`${buttonVariants({ variant: 'link' })} min-h-11 self-start no-underline`}
        >
          Ver todas las compras
        </Link>
      ) : null}
    </section>
  )
}
