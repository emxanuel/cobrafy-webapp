import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useParams } from 'react-router'

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
  const location = useLocation()
  const contactsFailed = Number(
    (location.state as { contactsFailed?: number } | null)?.contactsFailed ?? 0,
  )
  const clientQuery = useClient(clientId)
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const [blocking, setBlocking] = useState(false)
  const [unblocking, setUnblocking] = useState(false)
  const block = useBlockClientMutation(clientId)
  const unblock = useUnblockClientMutation(clientId)
  const blockForm = useForm<BlockFormValues>({
    resolver: zodResolver(blockSchema),
    defaultValues: { reason: '' },
  })
  const unblockForm = useForm<BlockFormValues>({
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
  const references = client.contacts.filter(
    (item) => item.type === 'referencia' && item.is_active,
  )
  const guarantors = client.contacts.filter(
    (item) => item.type === 'garante' && item.is_active,
  )
  const blocked = client.is_blocked || client.status === 'blocked'

  return (
    <>
      <PageHeader
        title={client.name}
        description={`${client.doc_type === 'cedula' ? 'Cédula' : 'Pasaporte'} ${client.document ?? '—'}`}
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

      {contactsFailed > 0 ? (
        <Alert>
          El cliente se guardó, pero {contactsFailed === 1 ? 'un contacto no' : `${contactsFailed} contactos no`}
          {' '}se pudieron guardar. Agrégalos aquí para no volver a crear la ficha.
        </Alert>
      ) : null}

      {blocked ? (
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
          <dd className="text-heading m-0">
            {client.collector_membership_id ? 'Asignado' : 'Sin asignar'}
          </dd>
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
        {references.length === 0 ? (
          <p>Sin referencias.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {references.map((item) => (
              <li key={item.id} className="py-1">
                {item.name} · {item.phone} · {item.relationship}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-xl">Garantes</h2>
        {guarantors.length === 0 ? (
          <p>Sin garantes.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {guarantors.map((item) => (
              <li key={item.id} className="py-1">
                {item.name}
                {item.document ? ` · ${item.document}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!blocked && canBlockClients(role) ? (
        blocking ? (
          <form
            className="flex max-w-md flex-col gap-3"
            onSubmit={blockForm.handleSubmit((values) =>
              block.mutate(values.reason, { onSuccess: () => setBlocking(false) }),
            )}
          >
            <Field
              id="reason"
              label="Motivo del bloqueo"
              error={blockForm.formState.errors.reason?.message}
            >
              <TextArea id="reason" {...blockForm.register('reason')} />
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

      {blocked && canUnblockClients(role) ? (
        unblocking ? (
          <form
            className="flex max-w-md flex-col gap-3"
            onSubmit={unblockForm.handleSubmit((values) =>
              unblock.mutate(values.reason, { onSuccess: () => setUnblocking(false) }),
            )}
          >
            <Field
              id="unblock-reason"
              label="Motivo del desbloqueo"
              error={unblockForm.formState.errors.reason?.message}
            >
              <TextArea id="unblock-reason" {...unblockForm.register('reason')} />
            </Field>
            {unblock.isError && !forbiddenUnblock ? (
              <Alert>{getApiErrorMessage(unblock.error)}</Alert>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={unblock.isPending}>
                Confirmar desbloqueo
              </Button>
              <Button variant="ghost" onClick={() => setUnblocking(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setUnblocking(true)}>Desbloquear</Button>
        )
      ) : null}
    </>
  )
}
