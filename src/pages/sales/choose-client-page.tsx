import { useState } from 'react'
import { Link } from 'react-router'

import { useClientSearch } from '@/features/clients/hooks/use-clients-queries'
import { formatDocumentLine } from '@/features/clients/lib/display-document'
import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { Badge } from '@/features/shared/components/ui/badge'
import { buttonVariants } from '@/features/shared/components/ui/button'
import { EmptyState } from '@/features/shared/components/ui/empty-state'
import { Field, TextInput } from '@/features/shared/components/ui/field'
import { LoadingState } from '@/features/shared/components/ui/loading-state'
import { canCreateClients } from '@/features/shared/lib/roles'
import { cn } from '@/features/shared/lib/cn'

export function ChooseClientPage() {
  const [query, setQuery] = useState('')
  const search = useClientSearch(query.trim(), '')
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const items = search.data?.items ?? []
  const trimmed = query.trim()

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to="/clientes" className="text-accent inline-flex min-h-11 items-center no-underline">
          ‹ Clientes
        </Link>
        <h1 className="m-0 text-3xl tracking-tight">Nueva venta</h1>
        <p className="mt-1">¿A quién le vendes?</p>
      </div>

      <Field id="sale-client-search" label="Buscar cliente">
        <TextInput
          id="sale-client-search"
          value={query}
          placeholder="Nombre, cédula o teléfono"
          onChange={(event) => setQuery(event.target.value)}
        />
      </Field>

      {search.isPending ? (
        <LoadingState>
          <p>Buscando clientes…</p>
        </LoadingState>
      ) : null}

      {trimmed && !search.isPending && items.length === 0 ? (
        <EmptyState title={`No encontramos a «${trimmed}».`}>
          Revisa el nombre o registra al cliente.
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" role="list">
          {items.map((client) => {
            const blocked = client.is_blocked || client.status === 'blocked'
            return (
              <li key={client.id}>
                <Link
                  to={`/clientes/${client.id}/ventas/nueva`}
                  className={cn(
                    'border-border flex min-h-14 items-center justify-between rounded-md border px-3 py-2 no-underline',
                    blocked && 'opacity-70',
                  )}
                >
                  <div>
                    <p className="text-heading m-0 font-medium">{client.name}</p>
                    <p className="m-0 text-[13px]">
                      {formatDocumentLine(client.doc_type, client.document, role)}
                    </p>
                  </div>
                  {blocked ? (
                    <Badge tone="danger">⛔ Bloqueado</Badge>
                  ) : (
                    <span aria-hidden>›</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {canCreateClients(role) ? (
        <Link
          to="/clientes/nuevo?from=venta"
          className={`${buttonVariants({ variant: 'outline' })} w-full no-underline`}
        >
          ＋ Registrar cliente nuevo
        </Link>
      ) : null}
    </div>
  )
}
