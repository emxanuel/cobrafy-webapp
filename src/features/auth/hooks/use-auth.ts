import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import {
  acceptInvitation,
  login,
  logout,
  setupPin,
  unlockPin,
} from '@/features/auth/services/requests'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { queryClient } from '@/query-client'

export function destinationAfterLogin(options: {
  membershipCount: number
  pinConfigured: boolean
  locked: boolean
}) {
  if (options.pinConfigured && options.locked) return '/desbloquear'
  if (options.membershipCount > 1) return '/negocios'
  return '/clientes'
}

export function useLoginMutation() {
  const setSession = useSessionStore((s) => s.setSession)
  const setActiveBusinessId = useBusinessStore((s) => s.setActiveBusinessId)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      const locked = data.pin_configured
      setSession({
        accessToken: data.access_token,
        user: data.user,
        memberships: data.memberships,
        pinConfigured: data.pin_configured,
        locked,
      })
      if (data.memberships.length === 1) {
        setActiveBusinessId(data.memberships[0].business_id)
      } else {
        setActiveBusinessId(null)
      }
      navigate(
        destinationAfterLogin({
          membershipCount: data.memberships.length,
          pinConfigured: data.pin_configured,
          locked,
        }),
        { replace: true },
      )
    },
  })
}

export function useLogoutMutation() {
  const clearSession = useSessionStore((s) => s.clearSession)
  const clearBusiness = useBusinessStore((s) => s.clear)
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
      clearBusiness()
      navigate('/login', { replace: true })
    },
  })
}

export function useUnlockPinMutation() {
  const setLocked = useSessionStore((s) => s.setLocked)
  const memberships = useSessionStore((s) => s.memberships)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: unlockPin,
    onSuccess: () => {
      setLocked(false)
      navigate(
        destinationAfterLogin({
          membershipCount: memberships.length,
          pinConfigured: true,
          locked: false,
        }),
        { replace: true },
      )
    },
  })
}

export function useSetupPinMutation() {
  const setPinConfigured = useSessionStore((s) => s.setPinConfigured)
  const setLocked = useSessionStore((s) => s.setLocked)

  return useMutation({
    mutationFn: setupPin,
    onSuccess: () => {
      setPinConfigured(true)
      setLocked(false)
    },
  })
}

export function useAcceptInvitationMutation() {
  const setSession = useSessionStore((s) => s.setSession)
  const setActiveBusinessId = useBusinessStore((s) => s.setActiveBusinessId)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: ({
      token,
      first_name,
      last_name,
      password,
    }: {
      token: string
      first_name: string
      last_name: string
      password: string
    }) => acceptInvitation(token, { first_name, last_name, password }),
    onSuccess: (data) => {
      setSession({
        accessToken: data.access_token,
        user: data.user,
        memberships: data.memberships,
        pinConfigured: data.pin_configured,
        locked: false,
      })
      if (data.memberships.length === 1) {
        setActiveBusinessId(data.memberships[0].business_id)
      }
      navigate(
        destinationAfterLogin({
          membershipCount: data.memberships.length,
          pinConfigured: false,
          locked: false,
        }),
        { replace: true },
      )
    },
  })
}
