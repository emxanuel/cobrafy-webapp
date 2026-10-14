import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'

import { UNAUTHORIZED_EVENT } from '@/features/auth/stores/session-store'
import {
  canCreateClients,
  canEditClients,
  canManageMembers,
  canViewAudit,
} from '@/features/shared/lib/roles'
import { AppLayout } from '@/features/shared/components/app-layout'
import { SELECT_BUSINESS_EVENT } from '@/features/shared/services/client'
import { ProtectedLayout } from '@/pages/auth/protected-layout'
import { RoleGuard } from '@/pages/auth/role-guard'
import { RouteFallback } from '@/pages/route-fallback'
import { getQueryClient } from '@/query-client'

const LoginPage = lazy(async () => {
  const mod = await import('@/pages/auth/login-page')
  return { default: mod.LoginPage }
})
const AcceptInvitePage = lazy(async () => {
  const mod = await import('@/pages/auth/accept-invite-page')
  return { default: mod.AcceptInvitePage }
})
const PinSetupPage = lazy(async () => {
  const mod = await import('@/pages/auth/pin-setup-page')
  return { default: mod.PinSetupPage }
})
const PinUnlockPage = lazy(async () => {
  const mod = await import('@/pages/auth/pin-unlock-page')
  return { default: mod.PinUnlockPage }
})
const BusinessSelectorPage = lazy(async () => {
  const mod = await import('@/pages/business/selector-page')
  return { default: mod.BusinessSelectorPage }
})
const ClientDetailPage = lazy(async () => {
  const mod = await import('@/pages/clients/client-detail-page')
  return { default: mod.ClientDetailPage }
})
const ClientFormPage = lazy(async () => {
  const mod = await import('@/pages/clients/client-form-page')
  return { default: mod.ClientFormPage }
})
const ClientHistoryPage = lazy(async () => {
  const mod = await import('@/pages/clients/client-history-page')
  return { default: mod.ClientHistoryPage }
})
const ClientsListPage = lazy(async () => {
  const mod = await import('@/pages/clients/clients-list-page')
  return { default: mod.ClientsListPage }
})
const MembersPage = lazy(async () => {
  const mod = await import('@/pages/members/members-page')
  return { default: mod.MembersPage }
})
const AuditPage = lazy(async () => {
  const mod = await import('@/pages/audit/audit-page')
  return { default: mod.AuditPage }
})
const CheckPage = lazy(async () => {
  const mod = await import('@/pages/clients/check-page')
  return { default: mod.CheckPage }
})
const AuditUnauthorized = lazy(async () => {
  const mod = await import('@/pages/audit/audit-unauthorized')
  return { default: mod.AuditUnauthorized }
})

function SessionListeners() {
  const navigate = useNavigate()
  useEffect(() => {
    function onUnauthorized() {
      const queryClient = getQueryClient()
      void queryClient.cancelQueries().then(() => {
        queryClient.clear()
        navigate('/login', { replace: true })
      })
    }
    function onSelectBusiness() {
      navigate('/negocios', { replace: true })
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    window.addEventListener(SELECT_BUSINESS_EVENT, onSelectBusiness)
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
      window.removeEventListener(SELECT_BUSINESS_EVENT, onSelectBusiness)
    }
  }, [navigate])
  return null
}

export function Router() {
  return (
    <BrowserRouter>
      <SessionListeners />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invitar" element={<AcceptInvitePage />} />
          <Route path="/invitar/:token" element={<AcceptInvitePage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/desbloquear" element={<PinUnlockPage />} />
            <Route path="/negocios" element={<BusinessSelectorPage />} />
            <Route element={<AppLayout />}>
              <Route path="/clientes" element={<ClientsListPage />} />
              <Route path="/verificar" element={<CheckPage />} />
              <Route element={<RoleGuard allow={canCreateClients} />}>
                <Route path="/clientes/nuevo" element={<ClientFormPage />} />
              </Route>
              <Route path="/clientes/:clientId" element={<ClientDetailPage />} />
              <Route element={<RoleGuard allow={canEditClients} />}>
                <Route path="/clientes/:clientId/editar" element={<ClientFormPage />} />
              </Route>
              <Route path="/clientes/:clientId/historial" element={<ClientHistoryPage />} />
              <Route element={<RoleGuard allow={canManageMembers} />}>
                <Route path="/equipo" element={<MembersPage />} />
              </Route>
              <Route
                element={<RoleGuard allow={canViewAudit} unauthorized={<AuditUnauthorized />} />}
              >
                <Route path="/auditoria" element={<AuditPage />} />
              </Route>
              <Route path="/clave-rapida" element={<PinSetupPage />} />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/clientes" replace />} />
          <Route path="*" element={<Navigate to="/clientes" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
