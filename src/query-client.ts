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
        gcTime: 0,
      },
    },
  })
}

export let queryClient = createAppQueryClient()

export function getQueryClient() {
  return queryClient
}

export async function resetQueryCache(client: QueryClient = getQueryClient()) {
  await client.cancelQueries()
  client.getMutationCache().clear()
  client.clear()
}

export async function resetAppQueryClient() {
  await resetQueryCache(queryClient)
  queryClient = createAppQueryClient()
}
