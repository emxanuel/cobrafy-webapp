import { useNavigate, useParams } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import {
  useClient,
  useCreateClientMutation,
  useUpdateClientMutation,
} from '@/features/clients/hooks/use-clients-queries'
import { ClientForm } from '@/features/clients/components/client-form'
import { useMembersQuery } from '@/features/members/hooks/use-members-queries'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import type { FailedContact } from '@/features/clients/lib/failed-contacts-notice'
import { FAILED_CONTACTS_KEY } from '@/features/shared/lib/session-storage'
import { canManageMembers } from '@/features/shared/lib/roles'

export function ClientFormPage() {
  const { clientId } = useParams()
  const isEdit = Boolean(clientId)
  const navigate = useNavigate()
  const existing = useClient(clientId)
  const create = useCreateClientMutation()
  const update = useUpdateClientMutation(clientId ?? '')
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const members = useMembersQuery(canManageMembers(role))
  const collectors = (members.data ?? []).filter(
    (member) => member.role === 'cobrador' && member.is_active,
  )
  const pending = create.isPending || update.isPending
  const error = create.error ?? update.error

  if (isEdit && existing.isPending) {
    return <p>Cargando ficha…</p>
  }

  if (isEdit && existing.isError) {
    return <Alert>No se pudo abrir esta ficha.</Alert>
  }

  return (
    <>
      <PageHeader
        title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
        description="Completa la ficha. Puedes agregar varias referencias y garantes."
      />
      <ClientForm
        client={existing.data}
        collectors={collectors}
        pending={pending}
        error={error}
        submitLabel={isEdit ? 'Guardar cambios' : 'Guardar cliente'}
        onSubmit={(payload) => {
          function goToClient(savedId: string, failed: FailedContact[]) {
            if (failed.length > 0) {
              sessionStorage.setItem(FAILED_CONTACTS_KEY, JSON.stringify(failed))
            } else {
              sessionStorage.removeItem(FAILED_CONTACTS_KEY)
            }
            navigate(`/clientes/${savedId}`)
          }
          if (isEdit && clientId) {
            update.mutate(
              {
                client: payload.client,
                contacts: payload.contacts,
                previousContacts: existing.data?.contacts ?? [],
              },
              {
                onSuccess: (result) => goToClient(result.client.id, result.failed),
              },
            )
            return
          }
          create.mutate(payload, {
            onSuccess: (result) => goToClient(result.client.id, result.failed),
          })
        }}
      />
    </>
  )
}
