import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useBusinessStore } from '@/features/business/stores/business-store'
import { clientKeys } from '@/features/clients/query-keys'
import {
  blockClient,
  createClient,
  getClient,
  getClientHistory,
  searchClients,
  unblockClient,
  updateClient,
} from '@/features/clients/services/requests'
import type { ClientWrite } from '@/features/clients/services/types'

export function useClientSearch(query: string) {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useQuery({
    queryKey: clientKeys.search(businessId, query),
    queryFn: () => searchClients({ query }),
    enabled: Boolean(businessId),
  })
}

export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: clientKeys.detail(clientId ?? ''),
    queryFn: () => getClient(clientId!),
    enabled: Boolean(clientId),
  })
}

export function useClientHistory(clientId: string | undefined) {
  return useQuery({
    queryKey: clientKeys.history(clientId ?? ''),
    queryFn: () => getClientHistory(clientId!),
    enabled: Boolean(clientId),
  })
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useUpdateClientMutation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ClientWrite) => updateClient(clientId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useBlockClientMutation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => blockClient(clientId, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useUnblockClientMutation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unblockClient(clientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useLoadMoreHistory(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (cursor: string) => getClientHistory(clientId, cursor),
    onSuccess: (page) => {
      queryClient.setQueryData(clientKeys.history(clientId), (current) => {
        if (!current || typeof current !== 'object' || !('items' in current)) {
          return page
        }
        const prev = current as { items: unknown[]; next_cursor: string | null }
        return {
          items: [...prev.items, ...page.items],
          next_cursor: page.next_cursor,
        }
      })
    },
  })
}
