import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'

import { UNAUTHORIZED_EVENT } from '@/features/auth/stores/session-store'
import { SELECT_BUSINESS_EVENT } from '@/features/shared/services/client'
import { queryClient } from '@/query-client'
import { AppLayout } from '@/features/shared/components/app-layout'
import { AcceptInvitePage } from '@/pages/auth/accept-invite-page'
import { LoginPage } from '@/pages/auth/login-page'
import { PinSetupPage } from '@/pages/auth/pin-setup-page'
import { PinUnlockPage } from '@/pages/auth/pin-unlock-page'
import { ProtectedLayout } from '@/pages/auth/protected-layout'
import { BusinessSelectorPage } from '@/pages/business/selector-page'
import { ClientDetailPage } from '@/pages/clients/client-detail-page'
import { ClientFormPage } from '@/pages/clients/client-form-page'
import { ClientHistoryPage } from '@/pages/clients/client-history-page'
import { ClientsListPage } from '@/pages/clients/clients-list-page'
import { MembersPage } from '@/pages/members/members-page'

function SessionListeners() {
  const navigate = useNavigate()
  useEffect(() => {
    function onUnauthorized() {
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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invitar/:token" element={<AcceptInvitePage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/desbloquear" element={<PinUnlockPage />} />
          <Route path="/negocios" element={<BusinessSelectorPage />} />
          <Route element={<AppLayout />}>
            <Route path="/clientes" element={<ClientsListPage />} />
            <Route path="/clientes/nuevo" element={<ClientFormPage />} />
            <Route path="/clientes/:clientId" element={<ClientDetailPage />} />
            <Route path="/clientes/:clientId/editar" element={<ClientFormPage />} />
            <Route path="/clientes/:clientId/historial" element={<ClientHistoryPage />} />
            <Route path="/equipo" element={<MembersPage />} />
            <Route path="/clave-rapida" element={<PinSetupPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/clientes" replace />} />
        <Route path="*" element={<Navigate to="/clientes" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
