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
            (error.status === 401 ||
              error.status === 403 ||
              error.status === 404 ||
              error.status === 409 ||
              error.status === 422)
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

/** Test helper: always the current singleton after resetAppQueryClient. */
export function getQueryClient() {
  return queryClient
}

export async function resetQueryCache(client: QueryClient = queryClient) {
  await client.cancelQueries()
  client.getMutationCache().clear()
  client.clear()
}

/** Test-only: drop in-flight work and replace the singleton QueryClient. */
export async function resetAppQueryClient() {
  await resetQueryCache(queryClient)
  queryClient = createAppQueryClient()
}
