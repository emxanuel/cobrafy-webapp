import { useMutation, useQuery } from '@tanstack/react-query'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'

import {
  acceptInvitation,
  getMe,
  login,
  logout,
  setupPin,
  unlockPin,
} from '@/features/auth/services/requests'
import { safeInternalPath } from '@/features/auth/lib/safe-internal-path'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { switchBusiness } from '@/features/business/lib/switch-business'
import { isPinLockedError } from '@/features/shared/lib/api-error'
import { LOGIN_NOTICE_KEY } from '@/features/shared/lib/session-storage'
import { queryClient, resetQueryCache } from '@/query-client'

export function destinationAfterAuth(options: {
  needs_business_selection: boolean
}) {
  if (options.needs_business_selection) return '/negocios'
  return '/clientes'
}

export function useLoginMutation() {
  const applyAuth = useSessionStore((s) => s.applyAuth)
  const navigate = useNavigate()
  const location = useLocation()

  return useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      await queryClient.cancelQueries()
      queryClient.clear()
      applyAuth(data)
      const from = data.needs_business_selection
        ? undefined
        : safeInternalPath(
            (location.state as { from?: unknown } | null)?.from,
          )
      navigate(from ?? destinationAfterAuth(data), { replace: true })
    },
  })
}

export function useSelectBusinessMutation() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (businessId: string) =>
      switchBusiness(queryClient, businessId, () => {
        flushSync(() => {
          navigate('/clientes', { replace: true })
        })
      }),
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
    onSettled: async () => {
      await queryClient.cancelQueries()
      queryClient.clear()
      clearSession()
      navigate('/login', { replace: true })
    },
  })
}

export function useUnlockPinMutation() {
  const applyAuth = useSessionStore((s) => s.applyAuth)
  const clearSession = useSessionStore((s) => s.clearSession)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: unlockPin,
    onSuccess: (data) => {
      applyAuth(data)
      navigate(destinationAfterAuth(data), { replace: true })
    },
    onError: async (error) => {
      if (!isPinLockedError(error)) return
      try {
        if (useSessionStore.getState().accessToken) {
          await logout()
        }
      } catch {
        // Cerrar en el teléfono aunque el servidor ya no reconozca la sesión.
      }
      await resetQueryCache()
      sessionStorage.setItem(LOGIN_NOTICE_KEY, 'pin-locked')
      navigate('/login', { replace: true, state: { pinLocked: true } })
      clearSession()
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
