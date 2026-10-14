import { QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { authResponse } from '@/test/fixtures'
import { Router } from '@/router'
import { getQueryClient } from '@/query-client'

export function seedAuth(...args: Parameters<typeof authResponse>) {
  useSessionStore.getState().applyAuth(authResponse(...args))
}

export function renderApp(ui?: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  useSessionStore.getState().hydrate()
  useBusinessStore.getState().hydrate()
  const client = getQueryClient()
  return render(ui ?? <Router />, {
    ...options,
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}
