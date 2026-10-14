import { useNavigate } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { switchBusiness } from '@/features/business/lib/switch-business'
import { AuthShell } from '@/features/shared/components/auth-shell'
import { Button } from '@/features/shared/components/ui/button'
import { ROLE_LABEL } from '@/features/shared/lib/roles'
import { queryClient } from '@/query-client'

export function BusinessSelectorPage() {
  const memberships = useSessionStore((s) => s.memberships)
  const navigate = useNavigate()

  return (
    <AuthShell
      title="Elige el negocio"
      description="Trabajas en más de uno. Entra al que vas a usar ahora."
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {memberships.map((item) => (
          <li key={item.business_id}>
            <Button
              variant="outline"
              className="h-auto w-full flex-col items-start py-3"
              onClick={() => {
                switchBusiness(queryClient, item.business_id)
                navigate('/clientes', { replace: true })
              }}
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
