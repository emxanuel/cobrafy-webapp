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
  createContact,
  deleteContact,
  searchClients,
  unblockClient,
  updateClientWithContacts,
  updateContact,
} from '@/features/clients/services/requests'
import type {
  ClientCheckRequest,
  ClientCreate,
  ClientHistory,
  ClientRead,
  ContactCreate,
  ContactDraft,
  ContactRead,
  ContactUpdate,
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
      contacts: ContactDraft[]
    }) => createClientWithContacts(client, contacts),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useUpdateClientMutation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      client,
      contacts,
      previousContacts,
      previousClient,
    }: {
      client: ClientCreate
      contacts: ContactDraft[]
      previousContacts: ContactRead[]
      previousClient: ClientRead
    }) =>
      updateClientWithContacts(
        clientId,
        client,
        previousContacts,
        contacts,
        previousClient,
      ),
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

export function useVerifyClientMutation() {
  return useMutation({
    mutationFn: async (payload: ClientCheckRequest) => {
      const check = await checkClient(payload)
      if (!check.found || !check.client_id) {
        return { check, client: null, blockedAt: null as string | null }
      }
      const client = await getClient(check.client_id)
      let blockedAt: string | null = null
      if (check.is_blocked) {
        try {
          const page = await getClientHistory(check.client_id, { limit: 20 })
          blockedAt = page.events.find((event) => event.type === 'blocked')?.occurred_at ?? null
        } catch {
          blockedAt = null
        }
      }
      return { check, client, blockedAt }
    },
  })
}

export function useCreateContactMutation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ContactCreate) => createContact(clientId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useDeleteContactMutation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contactId: string) => deleteContact(clientId, contactId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useUpdateContactMutation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      contactId,
      payload,
    }: {
      contactId: string
      payload: ContactUpdate
    }) => updateContact(clientId, contactId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
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
