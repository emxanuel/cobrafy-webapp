import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router'

import { useAcceptInvitationMutation } from '@/features/auth/hooks/use-auth'
import {
  acceptInviteSchema,
  type AcceptInviteFormValues,
} from '@/features/auth/schemas'
import { getInvitation } from '@/features/auth/services/requests'
import { AuthShell } from '@/features/shared/components/auth-shell'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, TextInput } from '@/features/shared/components/ui/field'
import { getApiErrorMessage, getFieldErrors } from '@/features/shared/lib/api-error'
import { ROLE_LABEL } from '@/features/shared/lib/roles'

export function AcceptInvitePage() {
  const { token = '' } = useParams()
  const preview = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => getInvitation(token),
    enabled: Boolean(token),
  })
  const accept = useAcceptInvitationMutation()
  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      password: '',
      confirm_password: '',
    },
  })
  const apiFields = accept.isError ? getFieldErrors(accept.error) : {}

  if (preview.isPending) {
    return (
      <AuthShell title="Invitación">
        <p>Cargando…</p>
      </AuthShell>
    )
  }

  if (preview.isError || !preview.data || preview.data.status !== 'pending') {
    return (
      <AuthShell title="Invitación">
        <Alert>
          Esta invitación ya no sirve. Pídele al dueño que te envíe otra.
        </Alert>
      </AuthShell>
    )
  }

  const invite = preview.data

  return (
    <AuthShell
      title="Únete al negocio"
      description={`${invite.business_name} te invita como ${ROLE_LABEL[invite.role].toLowerCase()}. Tú eliges tu contraseña.`}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) =>
          accept.mutate({
            token,
            first_name: values.first_name,
            last_name: values.last_name,
            password: values.password,
          }),
        )}
        noValidate
      >
        {accept.isError ? (
          <Alert>{getApiErrorMessage(accept.error)}</Alert>
        ) : null}
        <Field id="invite-email" label="Correo">
          <TextInput id="invite-email" value={invite.email} readOnly />
        </Field>
        <Field
          id="first_name"
          label="Nombre"
          error={form.formState.errors.first_name?.message ?? apiFields.first_name}
        >
          <TextInput
            id="first_name"
            autoComplete="given-name"
            error={form.formState.errors.first_name?.message}
            {...form.register('first_name')}
          />
        </Field>
        <Field
          id="last_name"
          label="Apellido"
          error={form.formState.errors.last_name?.message ?? apiFields.last_name}
        >
          <TextInput
            id="last_name"
            autoComplete="family-name"
            error={form.formState.errors.last_name?.message}
            {...form.register('last_name')}
          />
        </Field>
        <Field
          id="password"
          label="Tu contraseña"
          error={form.formState.errors.password?.message ?? apiFields.password}
        >
          <TextInput
            id="password"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
        </Field>
        <Field
          id="confirm_password"
          label="Repite la contraseña"
          error={form.formState.errors.confirm_password?.message}
        >
          <TextInput
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.confirm_password?.message}
            {...form.register('confirm_password')}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={accept.isPending}>
          {accept.isPending ? 'Entrando…' : 'Aceptar e entrar'}
        </Button>
      </form>
    </AuthShell>
  )
}
