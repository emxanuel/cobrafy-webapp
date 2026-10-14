import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import { setSwitchingFromToken } from '@/features/auth/lib/switching-token'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { resetAppQueryClient } from '@/query-client'
import { resetData } from './handlers'
import { server } from './server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  setSwitchingFromToken(null)
  await resetAppQueryClient()
  server.resetHandlers()
  resetData()
  useSessionStore.getState().clearSession()
  useBusinessStore.getState().clear()
  sessionStorage.clear()
})

afterAll(() => {
  server.close()
})
