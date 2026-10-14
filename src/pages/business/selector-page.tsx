import { useSelectBusinessMutation } from '@/features/auth/hooks/use-auth'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { AuthShell } from '@/features/shared/components/auth-shell'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { getApiErrorMessage } from '@/features/shared/lib/api-error'
import { ROLE_LABEL } from '@/features/shared/lib/roles'

export function BusinessSelectorPage() {
  const memberships = useSessionStore((s) => s.memberships)
  const selectBusiness = useSelectBusinessMutation()

  return (
    <AuthShell
      title="Elige el negocio"
      description="Trabajas en más de uno. Entra al que vas a usar ahora."
    >
      {selectBusiness.isError ? (
        <Alert>{getApiErrorMessage(selectBusiness.error)}</Alert>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {memberships.map((item) => (
          <li key={item.business_id}>
            <Button
              variant="outline"
              className="h-auto w-full flex-col items-start py-3"
              disabled={selectBusiness.isPending}
              onClick={() => selectBusiness.mutate(item.business_id)}
            >
              <span className="text-heading text-base">{item.business_name}</span>
              <span className="text-text text-sm">{ROLE_LABEL[item.role]}</span>
            </Button>
          </li>
        ))}
      </ul>
    </AuthShell>
  )
}
