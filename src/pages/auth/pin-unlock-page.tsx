import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { useLogoutMutation, useUnlockPinMutation } from '@/features/auth/hooks/use-auth'
import { pinUnlockSchema, type PinUnlockFormValues } from '@/features/auth/schemas'
import { AuthShell } from '@/features/shared/components/auth-shell'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, TextInput } from '@/features/shared/components/ui/field'
import { getApiErrorMessage, getFieldErrors } from '@/features/shared/lib/api-error'

export function PinUnlockPage() {
  const unlock = useUnlockPinMutation()
  const logout = useLogoutMutation()
  const form = useForm<PinUnlockFormValues>({
    resolver: zodResolver(pinUnlockSchema),
    defaultValues: { pin: '' },
  })
  const apiFields = unlock.isError ? getFieldErrors(unlock.error) : {}

  return (
    <AuthShell
      title="Clave rápida"
      description="Escribe tu clave de 4 a 6 números para seguir. No sustituye el primer login."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => unlock.mutate(values))}
        noValidate
      >
        {unlock.isError ? (
          <Alert>{getApiErrorMessage(unlock.error, 'Clave incorrecta.')}</Alert>
        ) : null}
        <Field
          id="pin"
          label="Clave rápida"
          error={form.formState.errors.pin?.message ?? apiFields.pin}
        >
          <TextInput
            id="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            error={form.formState.errors.pin?.message ?? apiFields.pin}
            {...form.register('pin')}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={unlock.isPending}>
          {unlock.isPending ? 'Abriendo…' : 'Continuar'}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Usar otro correo
        </Button>
      </form>
    </AuthShell>
  )
}
