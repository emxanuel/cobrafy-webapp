import type { QueryClient } from '@tanstack/react-query'

import { useBusinessStore } from '@/features/business/stores/business-store'

export function switchBusiness(queryClient: QueryClient, businessId: string) {
  useBusinessStore.getState().setActiveBusinessId(businessId)
  queryClient.clear()
}
