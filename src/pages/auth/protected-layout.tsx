import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'

export function ProtectedLayout() {
  const location = useLocation()
  const hydrated = useSessionStore((s) => s.hydrated)
  const accessToken = useSessionStore((s) => s.accessToken)
  const locked = useSessionStore((s) => s.locked)
  const pinConfigured = useSessionStore((s) => s.pinConfigured)
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const setActiveBusinessId = useBusinessStore((s) => s.setActiveBusinessId)

  useEffect(() => {
    if (memberships.length === 1 && !activeBusinessId) {
      setActiveBusinessId(memberships[0].business_id)
    }
  }, [memberships, activeBusinessId, setActiveBusinessId])

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

  if (pinConfigured && locked && !onPin) {
    return <Navigate to="/desbloquear" replace />
  }

  if (!locked && memberships.length > 1 && !activeBusinessId && !onSelector) {
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
