import { useState } from 'react'
import { Link } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { useClientSearch } from '@/features/clients/hooks/use-clients-queries'
import { PageHeader } from '@/features/shared/components/page-header'
import { buttonVariants } from '@/features/shared/components/ui/button'
import { TextInput } from '@/features/shared/components/ui/field'
import { Alert } from '@/features/shared/components/ui/alert'
import { cn } from '@/features/shared/lib/cn'
import { canCreateClients } from '@/features/shared/lib/roles'
import { getApiErrorMessage } from '@/features/shared/lib/api-error'

const EMPTY_COPY = 'Aún no tienes clientes…'

export function ClientsListPage() {
  const [query, setQuery] = useState('')
  const search = useClientSearch(query.trim())
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const items = search.data?.items ?? []
  const isEmpty = !search.isPending && items.length === 0 && !query.trim()

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Busca por nombre o documento. El documento nunca va en la dirección de la página."
        action={
          canCreateClients(role) ? (
            <Link
              to="/clientes/nuevo"
              className={cn(buttonVariants({ variant: 'primary' }), 'w-full no-underline sm:w-auto')}
            >
              Nuevo cliente
            </Link>
          ) : null
        }
      />

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="client-search" className="sr-only">
          Buscar clientes
        </label>
        <TextInput
          id="client-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o documento"
        />
      </form>

      {search.isError ? (
        <Alert>
          {search.error && 'status' in search.error && search.error.status === 403
            ? 'No tienes permiso para ver estos clientes.'
            : getApiErrorMessage(search.error)}
        </Alert>
      ) : null}

      {search.isPending ? <p>Cargando clientes…</p> : null}

      {isEmpty ? (
        <p data-testid="clients-empty">{EMPTY_COPY}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((client) => (
            <li key={client.id}>
              <Link
                to={`/clientes/${client.id}`}
                className="border-border hover:border-accent-border block rounded-md border px-4 py-3 text-left no-underline"
              >
                <span className="text-heading block font-medium">
                  {client.full_name}
                </span>
                <span className="text-text block text-sm">
                  {client.document_type === 'cedula' ? 'Cédula' : 'Pasaporte'}{' '}
                  {client.document_number}
                </span>
                {client.status === 'blocked' ? (
                  <span className="text-danger text-sm">Bloqueado</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {query.trim() && !search.isPending && items.length === 0 ? (
        <p>No hay clientes con esa búsqueda.</p>
      ) : null}
    </>
  )
}
