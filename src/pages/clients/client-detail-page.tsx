import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import {
  useBlockClientMutation,
  useClient,
  useUnblockClientMutation,
} from '@/features/clients/hooks/use-clients-queries'
import { blockSchema, type BlockFormValues } from '@/features/clients/schemas'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button, buttonVariants } from '@/features/shared/components/ui/button'
import { Field, TextArea } from '@/features/shared/components/ui/field'
import { getApiErrorMessage, isApiError } from '@/features/shared/lib/api-error'
import {
  canBlockClients,
  canEditClients,
  canUnblockClients,
} from '@/features/shared/lib/roles'

export function ClientDetailPage() {
  const { clientId = '' } = useParams()
  const clientQuery = useClient(clientId)
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const [blocking, setBlocking] = useState(false)
  const block = useBlockClientMutation(clientId)
  const unblock = useUnblockClientMutation(clientId)
  const form = useForm<BlockFormValues>({
    resolver: zodResolver(blockSchema),
    defaultValues: { reason: '' },
  })

  if (clientQuery.isPending) return <p>Cargando ficha…</p>
  if (clientQuery.isError) {
    return (
      <Alert>
        {isApiError(clientQuery.error) && clientQuery.error.status === 403
          ? 'No tienes permiso para ver este cliente.'
          : getApiErrorMessage(clientQuery.error)}
      </Alert>
    )
  }

  const client = clientQuery.data
  const forbiddenUnblock = isApiError(unblock.error) && unblock.error.status === 403

  return (
    <>
      <PageHeader
        title={client.full_name}
        description={`${client.document_type === 'cedula' ? 'Cédula' : 'Pasaporte'} ${client.document_number}`}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canEditClients(role) ? (
              <Link
                to={`/clientes/${client.id}/editar`}
                className={`${buttonVariants({ variant: 'outline' })} no-underline`}
              >
                Editar
              </Link>
            ) : null}
            <Link
              to={`/clientes/${client.id}/historial`}
              className={`${buttonVariants({ variant: 'outline' })} no-underline`}
            >
              Historial
            </Link>
          </div>
        }
      />

      {client.status === 'blocked' ? (
        <Alert>
          Bloqueado
          {client.blocked_reason ? `: ${client.blocked_reason}` : '.'}
        </Alert>
      ) : null}

      {forbiddenUnblock ? (
        <Alert>No tienes permiso para desbloquear.</Alert>
      ) : null}

      <dl className="m-0 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm">Teléfono</dt>
          <dd className="text-heading m-0">{client.phone}</dd>
        </div>
        <div>
          <dt className="text-sm">Cobrador</dt>
          <dd className="text-heading m-0">{client.collector_name ?? 'Sin asignar'}</dd>
        </div>
        {client.address ? (
          <div className="sm:col-span-2">
            <dt className="text-sm">Dirección</dt>
            <dd className="text-heading m-0">{client.address}</dd>
          </div>
        ) : null}
      </dl>

      <section>
        <h2 className="mt-0 mb-2 text-xl">Referencias</h2>
        {client.references.length === 0 ? (
          <p>Sin referencias.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {client.references.map((item, index) => (
              <li key={`${item.phone}-${index}`} className="py-1">
                {item.name} · {item.phone} · {item.relationship}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-xl">Fiadores</h2>
        {client.guarantors.length === 0 ? (
          <p>Sin fiadores.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {client.guarantors.map((item, index) => (
              <li key={`${item.document_number}-${index}`} className="py-1">
                {item.first_name} {item.last_name} · {item.document_number}
              </li>
            ))}
          </ul>
        )}
      </section>

      {client.status === 'active' && canBlockClients(role) ? (
        blocking ? (
          <form
            className="flex max-w-md flex-col gap-3"
            onSubmit={form.handleSubmit((values) =>
              block.mutate(values.reason, { onSuccess: () => setBlocking(false) }),
            )}
          >
            <Field
              id="reason"
              label="Motivo del bloqueo"
              error={form.formState.errors.reason?.message}
            >
              <TextArea id="reason" {...form.register('reason')} />
            </Field>
            {block.isError ? <Alert>{getApiErrorMessage(block.error)}</Alert> : null}
            <div className="flex gap-2">
              <Button type="submit" variant="danger" disabled={block.isPending}>
                Confirmar bloqueo
              </Button>
              <Button variant="ghost" onClick={() => setBlocking(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="danger" onClick={() => setBlocking(true)}>
            Bloquear
          </Button>
        )
      ) : null}

      {client.status === 'blocked' && canUnblockClients(role) ? (
        <Button
          onClick={() => unblock.mutate()}
          disabled={unblock.isPending}
        >
          Desbloquear
        </Button>
      ) : null}
    </>
  )
}
