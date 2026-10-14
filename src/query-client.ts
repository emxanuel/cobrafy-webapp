import { QueryClient } from '@tanstack/react-query'

import { isApiError } from '@/features/shared/lib/api-error'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (
            isApiError(error) &&
            (error.status === 401 || error.status === 403 || error.status === 404)
          ) {
            return false
          }
          return failureCount < 1
        },
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export const queryClient = createAppQueryClient()

export async function resetQueryCache(client: QueryClient = queryClient) {
  await client.cancelQueries()
  client.clear()
}
