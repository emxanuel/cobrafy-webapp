import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { useLoginMutation } from '@/features/auth/hooks/use-auth'
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas'
import { AuthShell } from '@/features/shared/components/auth-shell'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, TextInput } from '@/features/shared/components/ui/field'
import { getApiErrorMessage, getFieldErrors } from '@/features/shared/lib/api-error'

export function LoginPage() {
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
