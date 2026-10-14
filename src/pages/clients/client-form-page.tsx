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
import { LoadingState } from '@/features/shared/components/ui/loading-state'
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
    return (
      <LoadingState>
        <p>Cargando ficha…</p>
      </LoadingState>
    )
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
          if (isEdit && clientId) {
            if (!existing.data) return
            update.mutate(
              {
                client: payload.client,
                contacts: payload.contacts,
                previousContacts: existing.data.contacts,
                previousClient: existing.data,
              },
              {
                onSuccess: (result) => navigate(`/clientes/${result.client.id}`),
              },
            )
            return
          }
          create.mutate(payload, {
            onSuccess: (result) => navigate(`/clientes/${result.client.id}`),
          })
        }}
      />
    </>
  )
}
