import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import {
  acceptInvitation,
  getMe,
  login,
  logout,
  setupPin,
  unlockPin,
} from '@/features/auth/services/requests'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { switchBusiness } from '@/features/business/lib/switch-business'
import { queryClient } from '@/query-client'

export function destinationAfterAuth(options: {
  needs_business_selection: boolean
}) {
  if (options.needs_business_selection) return '/negocios'
  return '/clientes'
}

export function useLoginMutation() {
  const applyAuth = useSessionStore((s) => s.applyAuth)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      applyAuth(data)
      navigate(destinationAfterAuth(data), { replace: true })
    },
  })
}

export function useSelectBusinessMutation() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (businessId: string) => switchBusiness(queryClient, businessId),
    onSuccess: () => {
      navigate('/clientes', { replace: true })
    },
  })
}

export function useLogoutMutation() {
  const clearSession = useSessionStore((s) => s.clearSession)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      try {
        await logout()
      } catch {
        // Cerrar en el teléfono aunque el servidor ya no reconozca la sesión.
      }
    },
    onSettled: () => {
      queryClient.clear()
      clearSession()
      navigate('/login', { replace: true })
    },
  })
}

export function useUnlockPinMutation() {
  const applyAuth = useSessionStore((s) => s.applyAuth)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: unlockPin,
    onSuccess: (data) => {
      applyAuth(data)
      navigate(destinationAfterAuth(data), { replace: true })
    },
  })
}

export function useSetupPinMutation() {
  const markPinOnActive = useSessionStore((s) => s.markPinOnActive)

  return useMutation({
    mutationFn: setupPin,
    onSuccess: (_void, variables) => {
      markPinOnActive(variables.pin != null)
    },
  })
}

export function useMeQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    enabled,
  })
}

export function useAcceptInvitationMutation() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      navigate('/login', { replace: true, state: { invited: true } })
    },
  })
}
