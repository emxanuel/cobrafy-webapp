import { Link } from 'react-router'

import { buttonVariants } from '@/features/shared/components/ui/button'

export function BusinessUnauthorized() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="m-0 text-3xl tracking-tight">No autorizado</h1>
      <p className="m-0">No tienes permiso para ver la configuración del negocio.</p>
      <Link to="/clientes" className={`${buttonVariants({ variant: 'outline' })} no-underline`}>
        Volver a clientes
      </Link>
    </div>
  )
}
