import { useState } from 'react'
import { Link } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { useClientSearch } from '@/features/clients/hooks/use-clients-queries'
import type { ClientStatus } from '@/features/clients/services/types'
import { PageHeader } from '@/features/shared/components/page-header'
import { buttonVariants } from '@/features/shared/components/ui/button'
import { SelectInput, TextInput } from '@/features/shared/components/ui/field'
import { Alert } from '@/features/shared/components/ui/alert'
import { cn } from '@/features/shared/lib/cn'
import { canCreateClients } from '@/features/shared/lib/roles'
import { getApiErrorMessage } from '@/features/shared/lib/api-error'

const EMPTY_COPY = 'Aún no tienes clientes…'

export function ClientsListPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ClientStatus | ''>('')
  const search = useClientSearch(query.trim(), status)
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const items = search.data?.items ?? []
  const isEmpty = !search.isPending && items.length === 0 && !query.trim() && !status

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Busca por nombre o documento. El documento nunca va en la dirección de la página."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              to="/verificar"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full no-underline sm:w-auto')}
            >
              Verificar bloqueo
            </Link>
            {canCreateClients(role) ? (
              <Link
                to="/clientes/nuevo"
                className={cn(buttonVariants({ variant: 'primary' }), 'w-full no-underline sm:w-auto')}
              >
                Nuevo cliente
              </Link>
            ) : null}
          </div>
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
        <label htmlFor="client-status" className="sr-only">
          Estado
        </label>
        <SelectInput
          id="client-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as ClientStatus | '')}
        >
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="blocked">Bloqueados</option>
        </SelectInput>
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
                <span className="text-heading block font-medium">{client.name}</span>
                <span className="text-text block text-sm">
                  {client.doc_type === 'cedula' ? 'Cédula' : 'Pasaporte'}{' '}
                  {client.document ?? (client.document_available ? '' : '—')}
                </span>
                {client.is_blocked || client.status === 'blocked' ? (
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
