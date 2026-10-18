import { Link } from 'react-router'

import { buttonVariants } from '@/features/shared/components/ui/button'

export function SalesUnauthorized() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="m-0 text-3xl tracking-tight">No autorizado</h1>
      <p className="m-0">Solo el dueño y el cajero pueden registrar ventas.</p>
      <Link to="/clientes" className={`${buttonVariants({ variant: 'outline' })} no-underline`}>
        Volver a clientes
      </Link>
    </div>
  )
}
