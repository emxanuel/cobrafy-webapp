import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

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
import {
  BACK_LABEL,
  CLIENT_AND_GUARANTOR_SAVED_TOAST,
  COMPLETE_GUARANTOR_TITLE,
  SAVE_GUARANTOR_LABEL,
} from '@/features/clients/lib/complete-guarantor'
import { isPartialClientSaveError } from '@/features/clients/lib/document-field-errors'
import { useMembersQuery } from '@/features/members/hooks/use-members-queries'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { LoadingState } from '@/features/shared/components/ui/loading-state'
import { canManageMembers } from '@/features/shared/lib/roles'

export function ClientFormPage() {
  const { clientId } = useParams()
  const [searchParams] = useSearchParams()
  const fromVenta = searchParams.get('from') === 'venta'
  const isEdit = Boolean(clientId)
  const navigate = useNavigate()
  const existing = useClient(clientId)
  const create = useCreateClientMutation()
  const update = useUpdateClientMutation()
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const members = useMembersQuery(canManageMembers(role))
  const collectors = (members.data ?? []).filter(
    (member) => member.role === 'cobrador' && member.is_active,
  )
  const pending = create.isPending || update.isPending
  const error = create.error ?? update.error
  const [resumeClientId, setResumeClientId] = useState<string | null>(null)
  const submitting = useRef(false)
  if (!isEdit && isPartialClientSaveError(error) && !resumeClientId) {
    setResumeClientId(error.savedClient.id)
  }
  const completingGuarantor = Boolean(resumeClientId)

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
      {completingGuarantor ? (
        <Link
          to="/clientes"
          className="text-accent inline-flex min-h-11 items-center no-underline"
        >
          {BACK_LABEL}
        </Link>
      ) : null}
      <PageHeader
        title={
          completingGuarantor
            ? COMPLETE_GUARANTOR_TITLE
            : isEdit
              ? 'Editar cliente'
              : 'Nuevo cliente'
        }
        description={
          completingGuarantor
            ? undefined
            : 'Completa la ficha. Puedes agregar varias referencias y garantes.'
        }
      />
      <ClientForm
        key={clientId ?? 'nuevo'}
        client={existing.data}
        collectors={collectors}
        pending={pending}
        error={error}
        completingGuarantor={completingGuarantor}
        submitLabel={
          completingGuarantor
            ? SAVE_GUARANTOR_LABEL
            : isEdit
              ? 'Guardar cambios'
              : 'Guardar cliente'
        }
        onGoToRecord={
          resumeClientId
            ? () => navigate(`/clientes/${resumeClientId}`)
            : undefined
        }
        onSubmit={(payload) => {
          if (submitting.current) return
          submitting.current = true
          const releaseOnError = () => {
            submitting.current = false
          }
          const go = (result: { client: { id: string } }) => {
            if (completingGuarantor) {
              navigate(`/clientes/${result.client.id}`, {
                state: { toast: CLIENT_AND_GUARANTOR_SAVED_TOAST },
              })
              return
            }
            navigate(
              fromVenta
                ? `/clientes/${result.client.id}/ventas/nueva`
                : `/clientes/${result.client.id}`,
            )
          }
          if (isEdit && clientId) {
            if (!existing.data) {
              submitting.current = false
              return
            }
            update.mutate(
              {
                clientId,
                client: payload.client,
                contacts: payload.contacts,
                previousContacts: payload.resume?.previousContacts ?? existing.data.contacts,
                previousClient: payload.resume?.client ?? existing.data,
              },
              { onSuccess: go, onError: releaseOnError },
            )
            return
          }
          if (payload.resume) {
            create.reset()
            update.mutate(
              {
                clientId: payload.resume.client.id,
                client: payload.client,
                contacts: payload.contacts,
                previousContacts: payload.resume.previousContacts,
                previousClient: payload.resume.client,
              },
              { onSuccess: go, onError: releaseOnError },
            )
            return
          }
          create.mutate(
            { client: payload.client, contacts: payload.contacts },
            { onSuccess: go, onError: releaseOnError },
          )
        }}
      />
    </>
  )
}
