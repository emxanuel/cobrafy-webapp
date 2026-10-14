import { create } from 'zustand'

import type {
  AuthResponse,
  BusinessSummary,
  Membership,
  Role,
  UserRead,
} from '@/features/auth/services/types'
import { useBusinessStore } from '@/features/business/stores/business-store'
import {
  removeKey,
  readJson,
  SESSION_KEY,
  writeJson,
} from '@/features/shared/lib/session-storage'

export const UNAUTHORIZED_EVENT = 'cobrafy:unauthorized'

type PersistedSession = {
  accessToken: string
  user: UserRead
  memberships: Membership[]
  activeBusiness: BusinessSummary | null
  activeRole: Role | null
  needsBusinessSelection: boolean
}

type SessionState = {
  accessToken: string | null
  user: UserRead | null
  memberships: Membership[]
  activeBusiness: BusinessSummary | null
  activeRole: Role | null
  needsBusinessSelection: boolean
  locked: boolean
  hydrated: boolean
  applyAuth: (payload: AuthResponse, options?: { lockIfPin?: boolean }) => void
  setLocked: (locked: boolean) => void
  markPinOnActive: (hasPin: boolean) => void
  hydrate: () => void
  clearSession: () => void
}

function persist(state: Omit<PersistedSession, never>) {
  if (!state.accessToken || !state.user) {
    removeKey(SESSION_KEY)
    return
  }
  writeJson(SESSION_KEY, state)
}

function activeHasPin(memberships: Membership[], businessId: string | null): boolean {
  if (!businessId) return false
  return memberships.find((item) => item.business_id === businessId)?.has_pin ?? false
}

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  user: null,
  memberships: [],
  activeBusiness: null,
  activeRole: null,
  needsBusinessSelection: false,
  locked: false,
  hydrated: false,
  applyAuth: (payload, options) => {
    const activeId = payload.active_business?.id ?? null
    const hasPin = activeHasPin(payload.memberships, activeId)
    const next = {
      accessToken: payload.access_token,
      user: payload.user,
      memberships: payload.memberships,
      activeBusiness: payload.active_business,
      activeRole: payload.active_role,
      needsBusinessSelection: payload.needs_business_selection,
    }
    persist(next)
    useBusinessStore.getState().setActiveBusinessId(activeId)
    set({
      ...next,
      locked: options?.lockIfPin ? hasPin : false,
      hydrated: true,
    })
  },
  setLocked: (locked) => set({ locked }),
  markPinOnActive: (hasPin) => {
    const current = get()
    const businessId = current.activeBusiness?.id
    const memberships = current.memberships.map((item) =>
      item.business_id === businessId ? { ...item, has_pin: hasPin } : item,
    )
    persist({ ...current, memberships, accessToken: current.accessToken ?? '' })
    set({ memberships })
  },
  hydrate: () => {
    const saved = readJson<PersistedSession>(SESSION_KEY)
    if (!saved?.accessToken || !saved.user) {
      set({
        hydrated: true,
        accessToken: null,
        user: null,
        memberships: [],
        activeBusiness: null,
        activeRole: null,
        needsBusinessSelection: false,
        locked: false,
      })
      return
    }
    const activeId = saved.activeBusiness?.id ?? null
    useBusinessStore.getState().setActiveBusinessId(activeId)
    set({
      ...saved,
      locked: activeHasPin(saved.memberships, activeId),
      hydrated: true,
    })
  },
  clearSession: () => {
    removeKey(SESSION_KEY)
    useBusinessStore.getState().clear()
    set({
      accessToken: null,
      user: null,
      memberships: [],
      activeBusiness: null,
      activeRole: null,
      needsBusinessSelection: false,
      locked: false,
      hydrated: true,
    })
  },
}))

export function notifyUnauthorized() {
  useSessionStore.getState().clearSession()
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

export function activeMembershipFromSession(): Membership | null {
  const { memberships, activeBusiness } = useSessionStore.getState()
  if (!activeBusiness) return null
  return memberships.find((item) => item.business_id === activeBusiness.id) ?? null
}
