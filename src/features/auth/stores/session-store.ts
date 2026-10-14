import { create } from 'zustand'

import type { Membership, UserRead } from '@/features/auth/services/types'
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
  pinConfigured: boolean
}

type SessionState = {
  accessToken: string | null
  user: UserRead | null
  memberships: Membership[]
  pinConfigured: boolean
  locked: boolean
  hydrated: boolean
  setSession: (payload: PersistedSession & { locked?: boolean }) => void
  setLocked: (locked: boolean) => void
  setPinConfigured: (pinConfigured: boolean) => void
  hydrate: () => void
  clearSession: () => void
}

function persist(state: Pick<SessionState, 'accessToken' | 'user' | 'memberships' | 'pinConfigured'>) {
  if (!state.accessToken || !state.user) {
    removeKey(SESSION_KEY)
    return
  }
  const payload: PersistedSession = {
    accessToken: state.accessToken,
    user: state.user,
    memberships: state.memberships,
    pinConfigured: state.pinConfigured,
  }
  writeJson(SESSION_KEY, payload)
}

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  user: null,
  memberships: [],
  pinConfigured: false,
  locked: false,
  hydrated: false,
  setSession: ({ accessToken, user, memberships, pinConfigured, locked }) => {
    const nextLocked = locked ?? (pinConfigured ? true : false)
    persist({ accessToken, user, memberships, pinConfigured })
    set({
      accessToken,
      user,
      memberships,
      pinConfigured,
      locked: nextLocked,
      hydrated: true,
    })
  },
  setLocked: (locked) => set({ locked }),
  setPinConfigured: (pinConfigured) => {
    const current = get()
    persist({ ...current, pinConfigured })
    set({ pinConfigured })
  },
  hydrate: () => {
    const saved = readJson<PersistedSession>(SESSION_KEY)
    if (!saved?.accessToken || !saved.user) {
      set({ hydrated: true, accessToken: null, user: null, memberships: [], locked: false })
      return
    }
    set({
      accessToken: saved.accessToken,
      user: saved.user,
      memberships: saved.memberships,
      pinConfigured: saved.pinConfigured,
      locked: saved.pinConfigured,
      hydrated: true,
    })
  },
  clearSession: () => {
    removeKey(SESSION_KEY)
    set({
      accessToken: null,
      user: null,
      memberships: [],
      pinConfigured: false,
      locked: false,
      hydrated: true,
    })
  },
}))

export function notifyUnauthorized() {
  useSessionStore.getState().clearSession()
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}
