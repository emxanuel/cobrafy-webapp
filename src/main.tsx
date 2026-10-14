import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { Router } from '@/router'
import { queryClient } from '@/query-client'
import './index.css'

useSessionStore.getState().hydrate()
useBusinessStore.getState().hydrate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  </StrictMode>,
)
