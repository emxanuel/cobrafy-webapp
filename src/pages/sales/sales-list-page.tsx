import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { FilterChips, type SalesStatusFilter } from '@/features/sales/components/filter-chips'
import { SaleCard, SaleCardSkeleton } from '@/features/sales/components/sale-card'
import { useSalesList } from '@/features/sales/hooks/use-sales-queries'
import { CREDITS_EMPTY_TITLE } from '@/features/sales/lib/copy'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button, buttonVariants } from '@/features/shared/components/ui/button'
import { EmptyState } from '@/features/shared/components/ui/empty-state'
import { canSell } from '@/features/shared/lib/roles'

function parseStatus(raw: string | null): SalesStatusFilter {
  if (raw === 'active' || raw === 'voided') return raw
  return ''
}

export function SalesListPage() {
  const [params, setParams] = useSearchParams()
  const status = parseStatus(params.get('status'))
  const list = useSalesList(status)
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const allowSell = canSell(role)
  const items = useMemo(
    () => list.data?.pages.flatMap((page) => page.items) ?? [],
    [list.data],
  )
  const total = list.data?.pages[0]?.total ?? 0
  const isCollector = role === 'cobrador'
  const hasItems = items.length > 0
  const showFullError = list.isError && !list.data

  function setStatus(next: SalesStatusFilter) {
    const copy = new URLSearchParams(params)
    if (next) copy.set('status', next)
    else copy.delete('status')
    setParams(copy, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ventas"
        description={
          isCollector
            ? 'Ventas de los clientes que cobras.'
            : 'Ventas a crédito de tu negocio.'
        }
      />

      {allowSell ? (
        <Link
          to="/ventas/nueva"
          className={`${buttonVariants({ variant: 'primary' })} min-h-12 w-full no-underline`}
        >
          ＋ Nueva venta
        </Link>
      ) : null}

      <FilterChips value={status} onChange={setStatus} />

      {hasItems ? (
        <p className="m-0 text-sm tabular-nums">
          Mostrando {items.length} de {total} ventas
        </p>
      ) : null}

      {showFullError ? (
        <Alert
          icon="✕"
          title="No se pudieron cargar las ventas."
          action={
            <Button variant="outline" onClick={() => void list.refetch()}>
              Reintentar
            </Button>
          }
        >
          Revisa tu conexión e inténtalo de nuevo.
        </Alert>
      ) : null}

      {list.isLoading && !hasItems ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Cargando…</span>
          <SaleCardSkeleton />
          <SaleCardSkeleton />
        </div>
      ) : null}

      {!list.isLoading && !showFullError && items.length === 0 ? (
        status ? (
          <EmptyState
            title={status === 'active' ? 'No hay ventas activas.' : 'No hay ventas anuladas.'}
            action={
              <button
                type="button"
                className={`${buttonVariants({ variant: 'link' })} min-h-11`}
                onClick={() => setStatus('')}
              >
                Ver todas
              </button>
            }
          />
        ) : (
          <EmptyState
            title={CREDITS_EMPTY_TITLE}
            action={
              allowSell ? (
                <Link
                  to="/ventas/nueva"
                  className={`${buttonVariants({ variant: 'primary' })} min-h-11 no-underline`}
                >
                  ＋ Nueva venta
                </Link>
              ) : undefined
            }
          />
        )
      ) : null}

      {hasItems ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((sale) => (
            <li key={sale.id}>
              <SaleCard sale={sale} showClient />
            </li>
          ))}
        </ul>
      ) : null}

      {list.hasNextPage ? (
        <Button
          variant="outline"
          className="min-h-11 w-full"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          {list.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
        </Button>
      ) : null}

      {list.isFetchNextPageError ? (
        <Alert
          icon="✕"
          title="No pudimos cargar más ventas."
          action={
            <Button variant="outline" onClick={() => void list.fetchNextPage()}>
              Reintentar
            </Button>
          }
        />
      ) : null}
    </div>
  )
}
