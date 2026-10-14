import { create } from 'zustand'

import {
  BUSINESS_KEY,
  readJson,
  removeKey,
  writeJson,
} from '@/features/shared/lib/session-storage'
import type { Membership } from '@/features/auth/services/types'

type PersistedBusiness = {
  activeBusinessId: string | null
}

type BusinessState = {
  activeBusinessId: string | null
  setActiveBusinessId: (id: string | null) => void
  hydrate: () => void
  clear: () => void
}

export const useBusinessStore = create<BusinessState>((set) => ({
  activeBusinessId: null,
  setActiveBusinessId: (id) => {
    if (id) writeJson(BUSINESS_KEY, { activeBusinessId: id } satisfies PersistedBusiness)
    else removeKey(BUSINESS_KEY)
    set({ activeBusinessId: id })
  },
  hydrate: () => {
    const saved = readJson<PersistedBusiness>(BUSINESS_KEY)
    set({ activeBusinessId: saved?.activeBusinessId ?? null })
  },
  clear: () => {
    removeKey(BUSINESS_KEY)
    set({ activeBusinessId: null })
  },
}))

export function activeMembership(
  memberships: Membership[],
  activeBusinessId: string | null,
): Membership | null {
  if (!activeBusinessId) return null
  return memberships.find((item) => item.business_id === activeBusinessId) ?? null
}
