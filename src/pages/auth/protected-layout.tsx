import { Navigate, Outlet, useLocation } from 'react-router'

import { useMeQuery } from '@/features/auth/hooks/use-auth'
import { useSessionStore } from '@/features/auth/stores/session-store'

export function ProtectedLayout() {
  const location = useLocation()
  const hydrated = useSessionStore((s) => s.hydrated)
  const accessToken = useSessionStore((s) => s.accessToken)
  useMeQuery(hydrated && Boolean(accessToken))
  const locked = useSessionStore((s) => s.locked)
  const needsBusinessSelection = useSessionStore((s) => s.needsBusinessSelection)
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusiness = useSessionStore((s) => s.activeBusiness)
  const hasPin =
    memberships.find((item) => item.business_id === activeBusiness?.id)?.has_pin ??
    false

  if (!hydrated) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <p>Cargando…</p>
      </div>
    )
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const onPin = location.pathname.startsWith('/desbloquear')
  const onSelector = location.pathname.startsWith('/negocios')
  const onPinSetup = location.pathname.startsWith('/clave-rapida')

  if (hasPin && locked && !onPin) {
    return <Navigate to="/desbloquear" replace />
  }

  if (needsBusinessSelection && !onSelector && !onPin) {
    return <Navigate to="/negocios" replace />
  }

  if (onPin && !locked) {
    return <Navigate to="/clientes" replace />
  }

  if (!onSelector && !onPin && !onPinSetup && memberships.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center">
        <p>Tu usuario todavía no pertenece a un negocio.</p>
      </div>
    )
  }

  return <Outlet />
}
