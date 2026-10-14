import { QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { Router } from '@/router'
import { queryClient } from '@/query-client'

export function renderApp(ui?: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  useSessionStore.getState().hydrate()
  useBusinessStore.getState().hydrate()
  return render(ui ?? <Router />, {
    ...options,
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}
