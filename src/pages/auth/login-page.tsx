import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation } from 'react-router'

import { useLoginMutation } from '@/features/auth/hooks/use-auth'
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas'
import { AuthShell } from '@/features/shared/components/auth-shell'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, TextInput } from '@/features/shared/components/ui/field'
import {
  failedContactsNotice,
  parseContactsSaveNotice,
} from '@/features/clients/lib/failed-contacts-notice'
import { getApiErrorMessage, getFieldErrors } from '@/features/shared/lib/api-error'
import { FAILED_CONTACTS_KEY, LOGIN_NOTICE_KEY } from '@/features/shared/lib/session-storage'

export function LoginPage() {
  const location = useLocation()
  const invited = Boolean(
    (location.state as { invited?: boolean } | null)?.invited,
  )
  const pinLocked =
    Boolean((location.state as { pinLocked?: boolean } | null)?.pinLocked) ||
    sessionStorage.getItem(LOGIN_NOTICE_KEY) === 'pin-locked'

  const [contactsNotice] = useState(() =>
    parseContactsSaveNotice(sessionStorage.getItem(FAILED_CONTACTS_KEY)),
  )
  const contactsSaveNotice = failedContactsNotice(contactsNotice.failed, {
    applied: contactsNotice.applied,
    stoppedOnUnauthorized: contactsNotice.stoppedOnUnauthorized,
  })
  useEffect(() => {
    if (pinLocked) sessionStorage.removeItem(LOGIN_NOTICE_KEY)
    sessionStorage.removeItem(FAILED_CONTACTS_KEY)
  }, [pinLocked])
  const login = useLoginMutation()
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const apiFields = login.isError ? getFieldErrors(login.error) : {}

  return (
    <AuthShell
      title="Entra a tu negocio"
      description="Usa el correo y la contraseña que te dieron."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => login.mutate(values))}
        noValidate
      >
        {invited ? (
          <Alert tone="success">
            Listo. Entra con tu correo y la contraseña que acabas de crear.
          </Alert>
        ) : null}
        {pinLocked ? (
          <Alert>
            Demasiados intentos con la clave rápida. Entra con tu correo y contraseña.
          </Alert>
        ) : null}
        {contactsSaveNotice ? <Alert>{contactsSaveNotice}</Alert> : null}
        {login.isError ? (
          <Alert>{getApiErrorMessage(login.error, 'No se pudo entrar.')}</Alert>
        ) : null}
        <Field
          id="email"
          label="Correo"
          error={form.formState.errors.email?.message ?? apiFields.email}
        >
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            error={form.formState.errors.email?.message ?? apiFields.email}
            {...form.register('email')}
          />
        </Field>
        <Field
          id="password"
          label="Contraseña"
          error={form.formState.errors.password?.message ?? apiFields.password}
        >
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            error={form.formState.errors.password?.message ?? apiFields.password}
            {...form.register('password')}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthShell>
  )
}
