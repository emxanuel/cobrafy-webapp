import { useParams } from 'react-router'

import {
  useClient,
  useClientHistory,
  useLoadMoreHistory,
} from '@/features/clients/hooks/use-clients-queries'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { getApiErrorMessage } from '@/features/shared/lib/api-error'

export function ClientHistoryPage() {
  const { clientId = '' } = useParams()
  const client = useClient(clientId)
  const history = useClientHistory(clientId)
  const more = useLoadMoreHistory(clientId)

  return (
    <>
      <PageHeader
        title="Historial"
        description={client.data ? client.data.full_name : 'Movimientos de esta ficha.'}
      />
      {history.isError ? (
        <Alert>{getApiErrorMessage(history.error)}</Alert>
      ) : null}
      {history.isPending ? <p>Cargando historial…</p> : null}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {(history.data?.items ?? []).map((event) => (
          <li key={event.id} className="border-border rounded-md border px-4 py-3 text-left">
            <p className="text-heading m-0">{event.summary}</p>
            <p className="m-0 text-sm">
              {event.actor_name} · {new Date(event.occurred_at).toLocaleString()}
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
