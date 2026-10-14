import { useParams } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import {
  useClient,
  useClientHistory,
  useLoadMoreHistory,
} from '@/features/clients/hooks/use-clients-queries'
import type { HistoryEvent, HistoryEventType } from '@/features/clients/services/types'
import { useMembersQuery } from '@/features/members/hooks/use-members-queries'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { getApiErrorMessage } from '@/features/shared/lib/api-error'
import { formatDateTime } from '@/features/shared/lib/format-date'
import { canManageMembers, canSeeHistoryActor } from '@/features/shared/lib/roles'

const EVENT_LABEL: Record<HistoryEventType, string> = {
  blocked: 'Bloqueo',
  unblocked: 'Desbloqueo',
  collector_assigned: 'Se asignó cobrador',
  collector_reassigned: 'Se reasignó cobrador',
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
  const actorNameByMembership = new Map(
    (members.data ?? []).map((member) => [member.id, member.name]),
  )

  function actorLabel(event: HistoryEvent): string | null {
    if (!showActor || !event.actor.membership_id) return null
    return actorNameByMembership.get(event.actor.membership_id) ?? 'Alguien del negocio'
  }

  return (
    <>
      <PageHeader
        title="Historial"
        description={client.data ? client.data.name : 'Movimientos de esta ficha.'}
      />
      {history.isError ? <Alert>{getApiErrorMessage(history.error)}</Alert> : null}
      {history.isPending ? <p>Cargando historial…</p> : null}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {(history.data?.events ?? []).map((event) => (
          <li key={event.id} className="border-border rounded-md border px-4 py-3 text-left">
            <p className="text-heading m-0">{EVENT_LABEL[event.type]}</p>
            {event.reason ? <p className="m-0">{event.reason}</p> : null}
            <p className="m-0 text-sm">
              {actorLabel(event) ? `${actorLabel(event)} · ` : ''}
              {formatDateTime(event.occurred_at)}
            </p>
          </li>
        ))}
      </ol>
      {history.data?.next_cursor ? (
        <Button
          variant="outline"
          disabled={more.isPending}
          onClick={() => more.mutate(history.data!.next_cursor!)}
        >
          {more.isPending ? 'Cargando…' : 'Ver más'}
        </Button>
      ) : null}
    </>
  )
}
