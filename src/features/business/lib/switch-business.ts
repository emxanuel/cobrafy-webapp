import type { QueryClient } from '@tanstack/react-query'

import { setSwitchingFromToken } from '@/features/auth/lib/switching-token'
import { selectBusiness } from '@/features/auth/services/requests'
import { useSessionStore } from '@/features/auth/stores/session-store'

export async function switchBusiness(
  queryClient: QueryClient,
  businessId: string,
  afterAuth?: () => void,
) {
  setSwitchingFromToken(useSessionStore.getState().accessToken)
  try {
    const result = await selectBusiness({ business_id: businessId })
    await queryClient.cancelQueries()
    queryClient.clear()
    afterAuth?.()
    useSessionStore.getState().applyAuth(result)
    return result
  } finally {
    setSwitchingFromToken(null)
  }
}
