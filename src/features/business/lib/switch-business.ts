import type { QueryClient } from '@tanstack/react-query'

import { selectBusiness } from '@/features/auth/services/requests'
import { useSessionStore } from '@/features/auth/stores/session-store'

export async function switchBusiness(
  queryClient: QueryClient,
  businessId: string,
  afterAuth?: () => void,
) {
  const result = await selectBusiness({ business_id: businessId })
  await queryClient.cancelQueries()
  queryClient.clear()
  useSessionStore.getState().applyAuth(result)
  afterAuth?.()
  return result
}
