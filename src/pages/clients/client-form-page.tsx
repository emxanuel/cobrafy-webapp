import { useNavigate, useParams } from 'react-router'

import {
  useClient,
  useCreateClientMutation,
  useUpdateClientMutation,
} from '@/features/clients/hooks/use-clients-queries'
import { ClientForm } from '@/features/clients/components/client-form'
import { useMembersQuery } from '@/features/members/hooks/use-members-queries'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'

export function ClientFormPage() {
  const { clientId } = useParams()
  const isEdit = Boolean(clientId)
  const navigate = useNavigate()
  const existing = useClient(clientId)
  const create = useCreateClientMutation()
  const update = useUpdateClientMutation(clientId ?? '')
  const members = useMembersQuery(true)
  const collectors = (members.data?.items ?? []).filter(
    (member) => member.role === 'collector' && member.status === 'active',
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
        description="Completa la ficha. Puedes agregar varias referencias y fiadores."
      />
      <ClientForm
        client={existing.data}
        collectors={collectors}
        pending={pending}
        error={error}
        submitLabel={isEdit ? 'Guardar cambios' : 'Guardar cliente'}
        onSubmit={(payload) => {
          if (isEdit && clientId) {
            update.mutate(payload, {
              onSuccess: (saved) => navigate(`/clientes/${saved.id}`),
            })
            return
          }
          create.mutate(payload, {
            onSuccess: (saved) => navigate(`/clientes/${saved.id}`),
          })
        }}
      />
    </>
  )
}
