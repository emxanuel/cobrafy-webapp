import { Link } from 'react-router'

import { buttonVariants } from '@/features/shared/components/ui/button'

export function AuditUnauthorized() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="m-0 text-3xl tracking-tight">No autorizado</h1>
      <p className="m-0">Solo el dueño del negocio puede ver la bitácora.</p>
      <Link to="/clientes" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
        Volver a clientes
      </Link>
    </div>
  )
}
