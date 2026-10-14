import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router'

import { useAcceptInvitationMutation } from '@/features/auth/hooks/use-auth'
import { extractInviteToken } from '@/features/auth/lib/extract-invite-token'
import {
  acceptInviteSchema,
  type AcceptInviteFormValues,
} from '@/features/auth/schemas'
import { AuthShell } from '@/features/shared/components/auth-shell'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, TextInput } from '@/features/shared/components/ui/field'
import { getApiErrorMessage, getFieldErrors } from '@/features/shared/lib/api-error'

export function AcceptInvitePage() {
  const { token: tokenParam = '' } = useParams()
  return <AcceptInviteForm key={tokenParam} tokenParam={tokenParam} />
}

function AcceptInviteForm({ tokenParam }: { tokenParam: string }) {
  const [inviteInput, setInviteInput] = useState(tokenParam)
  const [tokenError, setTokenError] = useState('')
  const accept = useAcceptInvitationMutation()
  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      name: '',
      password: '',
      confirm_password: '',
    },
  })
  const apiFields = accept.isError ? getFieldErrors(accept.error) : {}

  return (
    <AuthShell
      title="Únete al negocio"
      description="Si es tu primera vez, escribe tu nombre y elige tu contraseña. El dueño no la pone por ti. Si no tienes el enlace, pega el código o el enlace completo."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => {
          const token = extractInviteToken(inviteInput) || extractInviteToken(tokenParam)
          if (!token) {
            setTokenError('Pega el enlace o el código de la invitación.')
            return
          }
          setTokenError('')
          accept.mutate({
            token,
            name: values.name,
            password: values.password,
          })
        })}
        noValidate
      >
        {accept.isError ? (
          <Alert>{getApiErrorMessage(accept.error)}</Alert>
        ) : null}
        <Field
          id="invite-token"
          label="Enlace o código de invitación"
          error={tokenError || apiFields.token}
          hint="Pégalo si abriste la app sin el enlace del correo."
        >
          <TextInput
            id="invite-token"
            autoComplete="off"
            value={inviteInput}
            error={tokenError || apiFields.token}
            onChange={(event) => {
              setInviteInput(event.target.value)
              if (tokenError) setTokenError('')
            }}
          />
        </Field>
        <Field
          id="name"
          label="Nombre"
          error={form.formState.errors.name?.message ?? apiFields.name}
        >
          <TextInput
            id="name"
            autoComplete="name"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
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
          {accept.isPending ? 'Guardando…' : 'Aceptar invitación'}
        </Button>
      </form>
    </AuthShell>
  )
}
