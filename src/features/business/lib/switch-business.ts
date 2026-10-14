import type { QueryClient } from '@tanstack/react-query'

import { selectBusiness } from '@/features/auth/services/requests'
import { useSessionStore } from '@/features/auth/stores/session-store'

export async function switchBusiness(
  queryClient: QueryClient,
  businessId: string,
  afterAuth?: () => void,
) {
  const result = await selectBusiness({ business_id: businessId })
  useSessionStore.getState().applyAuth(result)
  afterAuth?.()
  await queryClient.cancelQueries()
  queryClient.clear()
  return result
}
