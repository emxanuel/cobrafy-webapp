import { useParams } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { ClientRecordHeader } from '@/features/clients/components/client-record-header'
import {
  useClient,
  useClientHistory,
  useLoadMoreHistory,
} from '@/features/clients/hooks/use-clients-queries'
import type { HistoryEvent, HistoryEventType } from '@/features/clients/services/types'
import { useMembersQuery } from '@/features/members/hooks/use-members-queries'
import { Alert } from '@/features/shared/components/ui/alert'
import { Badge } from '@/features/shared/components/ui/badge'
import { Button } from '@/features/shared/components/ui/button'
import { EmptyState } from '@/features/shared/components/ui/empty-state'
import { Skeleton } from '@/features/shared/components/ui/skeleton'
import { isApiError } from '@/features/shared/lib/api-error'
import { formatDateTime } from '@/features/shared/lib/format-date'
import { canManageMembers, canSeeHistoryActor } from '@/features/shared/lib/roles'

const EVENT_LABEL: Record<HistoryEventType, string> = {
  blocked: 'Bloqueo',
  unblocked: 'Desbloqueo',
  collector_assigned: 'Se asignó cobrador',
  collector_reassigned: 'Se reasignó cobrador',
}

const EVENT_TONE: Record<HistoryEventType, 'danger' | 'success' | 'accent'> = {
  blocked: 'danger',
  unblocked: 'success',
  collector_assigned: 'accent',
  collector_reassigned: 'accent',
}

export function ClientHistoryPage() {
  const { clientId = '' } = useParams()
  const client = useClient(clientId)
  const history = useClientHistory(clientId)
  const more = useLoadMoreHistory(clientId)
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const showActor = canSeeHistoryActor(role)
  const members = useMembersQuery(canManageMembers(role))
  const nameByMembership = new Map(
    (members.data ?? []).map((member) => [member.id, member.name]),
  )

  function actorLabel(event: HistoryEvent): string | null {
    if (!showActor || !event.actor.membership_id) return null
    return nameByMembership.get(event.actor.membership_id) ?? 'Alguien del negocio'
  }

  function collectorName(id: string | null): string {
    if (!id) return 'Cobrador'
    return nameByMembership.get(id) ?? 'Cobrador'
  }

  function eventDetail(event: HistoryEvent): string | null {
    if (event.type === 'blocked' || event.type === 'unblocked') {
      return event.reason
    }
    if (event.type === 'collector_assigned') {
      return collectorName(event.to_collector_membership_id)
    }
    if (event.type === 'collector_reassigned') {
      return `${collectorName(event.from_collector_membership_id)} → ${collectorName(event.to_collector_membership_id)}`
    }
    return event.reason
  }

  const notFound =
    (isApiError(client.error) && client.error.status === 404) ||
    (isApiError(history.error) && history.error.status === 404)

  if (notFound) {
    return (
      <Alert>Este cliente no existe o ya no está disponible.</Alert>
    )
  }

  return (
    <>
      <ClientRecordHeader client={client.data} role={role} />

      <section className="flex flex-col gap-2">
        <h2 className="text-heading m-0 text-lg">Eventos de la ficha</h2>
        <p className="m-0 text-sm">Del más reciente al más antiguo.</p>

        {history.isError ? (
          <>
            <Alert>No se pudo cargar el historial.</Alert>
            <Button variant="outline" onClick={() => void history.refetch()}>
              Reintentar
            </Button>
          </>
        ) : null}

        {history.isPending ? (
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            <HistorySkeleton />
            <HistorySkeleton />
            <HistorySkeleton />
          </ol>
        ) : null}

        {!history.isPending && !history.isError && (history.data?.events.length ?? 0) === 0 ? (
          <EmptyState className="py-4 text-left">Aún no hay movimientos en esta ficha.</EmptyState>
        ) : null}

        {(history.data?.events.length ?? 0) > 0 ? (
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {(history.data?.events ?? []).map((event) => (
              <li key={event.id} className="border-border rounded-md border px-4 py-3 text-left">
                <Badge tone={EVENT_TONE[event.type]}>{EVENT_LABEL[event.type]}</Badge>
                {eventDetail(event) ? <p className="m-0">{eventDetail(event)}</p> : null}
                <p className="m-0 text-sm">
                  {actorLabel(event) ? `${actorLabel(event)} · ` : ''}
                  {formatDateTime(event.occurred_at)}
                </p>
              </li>
            ))}
          </ol>
        ) : null}

        {history.data?.next_cursor ? (
          <Button
            variant="outline"
            disabled={more.isPending}
            onClick={() => more.mutate(history.data!.next_cursor!)}
          >
            {more.isPending ? 'Cargando…' : 'Ver más'}
          </Button>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-heading m-0 text-lg">Compras</h2>
        <EmptyState className="py-4 text-left">
          Aún no hay compras registradas para este cliente.
        </EmptyState>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-heading m-0 text-lg">Pagos</h2>
        <EmptyState className="py-4 text-left">
          Aún no hay pagos registrados para este cliente.
        </EmptyState>
      </section>
    </>
  )
}

function HistorySkeleton() {
  return (
    <li className="border-border rounded-md border px-4 py-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </li>
  )
}
