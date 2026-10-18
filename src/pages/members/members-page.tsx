import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import {
  useInvitationsQuery,
  useInviteMemberMutation,
  useMembersQuery,
  usePatchMemberMutation,
  useRevokeInvitationMutation,
} from '@/features/members/hooks/use-members-queries'
import type { MemberRead } from '@/features/members/services/types'
import { inviteSchema, type InviteFormValues } from '@/features/members/schemas'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, SelectInput, TextInput } from '@/features/shared/components/ui/field'
import { getApiErrorMessage, getFieldErrors, isApiError } from '@/features/shared/lib/api-error'
import { ROLE_LABEL } from '@/features/shared/lib/roles'

export function MembersPage() {
  const members = useMembersQuery(true)
  const invitations = useInvitationsQuery(true)
  const invite = useInviteMemberMutation()
  const patchMember = usePatchMemberMutation()
  const revoke = useRevokeInvitationMutation()
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'cajero' },
  })
  const apiFields = invite.isError ? getFieldErrors(invite.error) : {}
  const pendingInvites = (invitations.data ?? []).filter((item) => item.status === 'pending')

  return (
    <>
      <PageHeader
        title="Equipo"
        description="Invita por correo. La otra persona acepta y pone su propia contraseña. Tú nunca escribes la de ellos."
      />

      <form
        className="flex max-w-lg flex-col gap-3"
        onSubmit={form.handleSubmit((values) =>
          invite.mutate(values, { onSuccess: () => form.reset() }),
        )}
        noValidate
      >
        {invite.isError ? (
          <Alert>
            {isApiError(invite.error) && invite.error.status === 403
              ? 'No tienes permiso para invitar.'
              : getApiErrorMessage(invite.error)}
          </Alert>
        ) : null}
        {invite.isSuccess ? (
          <Alert tone="success">Invitación enviada. Que revisen su correo.</Alert>
        ) : null}
        <Field
          id="invite-email"
          label="Correo"
          error={form.formState.errors.email?.message ?? apiFields.email}
        >
          <TextInput
            id="invite-email"
            type="email"
            autoComplete="off"
            {...form.register('email')}
          />
        </Field>
        <Field id="invite-role" label="Rol" error={form.formState.errors.role?.message}>
          <SelectInput id="invite-role" {...form.register('role')}>
            <option value="cajero">Cajero</option>
            <option value="cobrador">Cobrador</option>
          </SelectInput>
        </Field>
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? 'Enviando…' : 'Enviar invitación'}
        </Button>
      </form>

      <section>
        <h2 className="mt-0 mb-3 text-xl">Personas del negocio</h2>
        {members.isError ? (
          <Alert>
            {isApiError(members.error) && members.error.status === 403
              ? 'No tienes permiso para ver el equipo.'
              : getApiErrorMessage(members.error)}
          </Alert>
        ) : null}
        {patchMember.isError ? (
          <Alert>
            {isApiError(patchMember.error) && patchMember.error.code === 'LAST_ACTIVE_OWNER'
              ? 'El negocio debe tener al menos un dueño activo.'
              : getApiErrorMessage(patchMember.error)}
          </Alert>
        ) : null}
        <ul className="m-0 list-none p-0">
          {(members.data ?? []).map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              pending={patchMember.isPending}
              onPatch={(payload) =>
                patchMember.mutate({ memberId: member.id, payload })
              }
            />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mt-0 mb-3 text-xl">Invitaciones pendientes</h2>
        {revoke.isError ? <Alert>{getApiErrorMessage(revoke.error)}</Alert> : null}
        {pendingInvites.length === 0 ? (
          <p>No hay invitaciones en espera.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {pendingInvites.map((item) => (
              <li
                key={item.id}
                className="border-border flex flex-col gap-2 border-b py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-heading m-0">{item.email}</p>
                  <p className="m-0 text-sm">{ROLE_LABEL[item.role]} · Pendiente</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => revoke.mutate(item.id)}
                  disabled={revoke.isPending}
                >
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function MemberRow({
  member,
  pending,
  onPatch,
}: {
  member: MemberRead
  pending: boolean
  onPatch: (payload: { role?: MemberRead['role']; is_active?: boolean }) => void
}) {
  return (
    <li className="border-border flex flex-col gap-2 border-b py-3">
      <div>
        <p className="text-heading m-0">{member.name}</p>
        <p className="m-0 text-sm">
          {member.email}
          {member.is_active ? '' : ' · Inactivo'}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`role-${member.id}`}>
          Rol de {member.name}
        </label>
        <SelectInput
          id={`role-${member.id}`}
          value={member.role}
          disabled={pending}
          onChange={(event) =>
            onPatch({ role: event.target.value as MemberRead['role'] })
          }
        >
          <option value="dueño">Dueño</option>
          <option value="cajero">Cajero</option>
          <option value="cobrador">Cobrador</option>
        </SelectInput>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => onPatch({ is_active: !member.is_active })}
        >
          {member.is_active ? 'Desactivar' : 'Activar'}
        </Button>
      </div>
    </li>
  )
}
