import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { useSetupPinMutation } from '@/features/auth/hooks/use-auth'
import { pinSetupSchema, type PinSetupFormValues } from '@/features/auth/schemas'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, TextInput } from '@/features/shared/components/ui/field'
import { getApiErrorMessage, getFieldErrors } from '@/features/shared/lib/api-error'

export function PinSetupPage() {
  const navigate = useNavigate()
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusiness = useSessionStore((s) => s.activeBusiness)
  const hasPin =
    memberships.find((item) => item.business_id === activeBusiness?.id)?.has_pin ??
    false
  const setup = useSetupPinMutation()
  const form = useForm<PinSetupFormValues>({
    resolver: zodResolver(pinSetupSchema),
    defaultValues: { password: '', pin: '' },
  })
  const apiFields = setup.isError ? getFieldErrors(setup.error) : {}

  return (
    <>
      <PageHeader
        title={hasPin ? 'Cambiar clave rápida' : 'Configurar clave rápida'}
        description="Pide tu contraseña actual. La clave son 4 a 6 números, por negocio."
      />
      <form
        className="flex max-w-md flex-col gap-4"
        onSubmit={form.handleSubmit((values) =>
          setup.mutate(values, { onSuccess: () => navigate('/clientes') }),
        )}
        noValidate
      >
        {setup.isError ? (
          <Alert>{getApiErrorMessage(setup.error)}</Alert>
        ) : null}
        <Field
          id="password"
          label="Contraseña actual"
          error={form.formState.errors.password?.message ?? apiFields.password}
        >
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
        </Field>
        <Field
          id="pin"
          label="Clave rápida"
          error={form.formState.errors.pin?.message ?? apiFields.pin}
        >
          <TextInput
            id="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            error={form.formState.errors.pin?.message ?? apiFields.pin}
            {...form.register('pin')}
          />
        </Field>
        <Button type="submit" disabled={setup.isPending}>
          {setup.isPending ? 'Guardando…' : 'Guardar clave'}
        </Button>
      </form>
    </>
  )
}
