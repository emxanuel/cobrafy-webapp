import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useBusinessStore } from '@/features/business/stores/business-store'
import { clientKeys } from '@/features/clients/query-keys'
import {
  blockClient,
  checkClient,
  createClientWithContacts,
  getClient,
  getClientHistory,
  listClients,
  searchClients,
  unblockClient,
  updateClient,
} from '@/features/clients/services/requests'
import type {
  ClientCheckRequest,
  ClientCreate,
  ClientHistory,
  ClientUpdate,
  ContactCreate,
} from '@/features/clients/services/types'

export function useClientSearch(query: string, status: 'active' | 'blocked' | '') {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  const trimmed = query.trim()
  return useQuery({
    queryKey: clientKeys.search(businessId, trimmed, status),
    queryFn: () => {
      if (!trimmed) {
        return listClients({
          page: 1,
          page_size: 50,
          ...(status ? { status } : {}),
        })
      }
      return searchClients({
        q: trimmed,
        page: 1,
        page_size: 50,
      })
    },
    enabled: Boolean(businessId),
  })
}

export function useClient(clientId: string | undefined) {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useQuery({
    queryKey: clientKeys.detail(businessId, clientId ?? ''),
    queryFn: () => getClient(clientId!),
    enabled: Boolean(clientId) && Boolean(businessId),
  })
}

export function useClientHistory(clientId: string | undefined) {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useQuery({
    queryKey: clientKeys.history(businessId, clientId ?? ''),
    queryFn: () => getClientHistory(clientId!, { limit: 20 }),
    enabled: Boolean(clientId) && Boolean(businessId),
  })
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      client,
      contacts,
    }: {
      client: ClientCreate
      contacts: ContactCreate[]
    }) => createClientWithContacts(client, contacts),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useUpdateClientMutation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ClientUpdate) => updateClient(clientId, payload),
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
    mutationFn: (reason: string) => unblockClient(clientId, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useCheckClientMutation() {
  return useMutation({
    mutationFn: (payload: ClientCheckRequest) => checkClient(payload),
  })
}

export function useLoadMoreHistory(clientId: string) {
  const queryClient = useQueryClient()
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useMutation({
    mutationFn: (before: string) =>
      getClientHistory(clientId, { limit: 20, before }),
    onSuccess: (page) => {
      queryClient.setQueryData(clientKeys.history(businessId, clientId), (current) => {
        if (!current || typeof current !== 'object' || !('events' in current)) {
          return page
        }
        const prev = current as ClientHistory
        return {
          ...prev,
          events: [...prev.events, ...page.events],
          next_cursor: page.next_cursor,
        }
      })
    },
  })
}
