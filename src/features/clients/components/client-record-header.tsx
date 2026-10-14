import { NavLink } from 'react-router'

import { formatDocumentLine } from '@/features/clients/lib/display-document'
import type { ClientRead } from '@/features/clients/services/types'
import type { Role } from '@/features/auth/services/types'
import { Badge } from '@/features/shared/components/ui/badge'
import { cn } from '@/features/shared/lib/cn'

function tabClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex min-h-11 flex-1 items-center justify-center border-b-2',
    isActive
      ? 'border-accent text-heading font-medium'
      : 'border-transparent text-text hover:text-heading',
  )
}

export function ClientRecordHeader({
  client,
  role,
}: {
  client?: ClientRead | null
  role: Role | null
}) {
  const blocked = Boolean(client && (client.is_blocked || client.status === 'blocked'))

  return (
    <>
      <header>
        <h1 className="m-0 text-3xl tracking-tight">
          {client?.name ?? 'Cliente'}
        </h1>
        {client ? (
          <p className="mt-1">
            {formatDocumentLine(client.doc_type, client.document, role)}
            {blocked ? (
              <Badge tone="danger" className="ml-1">
                Bloqueado
              </Badge>
            ) : null}
          </p>
        ) : null}
      </header>
      {client ? <ClientSectionNav clientId={client.id} /> : null}
    </>
  )
}

export function ClientSectionNav({ clientId }: { clientId: string }) {
  return (
    <nav
      className="border-border -mx-4 flex border-b px-4 sm:-mx-6 sm:px-6"
      aria-label="Secciones del cliente"
    >
      <NavLink to={`/clientes/${clientId}`} end className={tabClass}>
        Ficha
      </NavLink>
      <NavLink to={`/clientes/${clientId}/historial`} className={tabClass}>
        Historial
      </NavLink>
    </nav>
  )
}
