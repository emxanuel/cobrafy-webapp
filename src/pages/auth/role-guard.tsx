import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'

import type { Role } from '@/features/auth/services/types'
import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'

export function RoleGuard({
  allow,
  unauthorized,
}: {
  allow: (role: Role | null) => boolean
  unauthorized?: ReactNode
}) {
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null

  if (!allow(role)) {
    return unauthorized ?? <Navigate to="/clientes" replace />
  }

  return <Outlet />
}
