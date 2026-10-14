import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { queryClient } from '@/query-client'
import { resetData } from './handlers'
import { server } from './server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetData()
  queryClient.clear()
  useSessionStore.getState().clearSession()
  useBusinessStore.getState().clear()
  sessionStorage.clear()
})

afterAll(() => {
  server.close()
})
