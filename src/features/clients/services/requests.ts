import { api } from '@/features/shared/services/client'
import type {
  ClientCheckRead,
  ClientCheckRequest,
  ClientCreate,
  ClientDetail,
  ClientHistory,
  ClientPage,
  ClientRead,
  ClientReason,
  ClientSearchRequest,
  ClientUpdate,
  ContactCreate,
  ContactRead,
} from './types'

export async function listClients(params?: {
  status?: 'active' | 'blocked'
  collector_membership_id?: string
  page?: number
  page_size?: number
}): Promise<ClientPage> {
  const { data } = await api.get<ClientPage>('/clients', { params })
  return data
}

export async function searchClients(
  payload: ClientSearchRequest,
): Promise<ClientPage> {
  const { data } = await api.post<ClientPage>('/clients/search', payload)
  return data
}

export async function checkClient(
  payload: ClientCheckRequest,
): Promise<ClientCheckRead> {
  const { data } = await api.post<ClientCheckRead>('/clients/check', payload)
  return data
}

export async function getClient(clientId: string): Promise<ClientDetail> {
  const { data } = await api.get<ClientDetail>(`/clients/${clientId}`)
  return data
}

export async function createClient(payload: ClientCreate): Promise<ClientRead> {
  const { data } = await api.post<ClientRead>('/clients', payload)
  return data
}

export async function updateClient(
  clientId: string,
  payload: ClientUpdate,
): Promise<ClientRead> {
  const { data } = await api.patch<ClientRead>(`/clients/${clientId}`, payload)
  return data
}

export async function blockClient(
  clientId: string,
  payload: ClientReason,
): Promise<ClientRead> {
  const { data } = await api.post<ClientRead>(`/clients/${clientId}/block`, payload)
  return data
}

export async function unblockClient(
  clientId: string,
  payload: ClientReason,
): Promise<ClientRead> {
  const { data } = await api.post<ClientRead>(`/clients/${clientId}/unblock`, payload)
  return data
}

export async function getClientHistory(
  clientId: string,
  options?: { limit?: number; before?: string | null },
): Promise<ClientHistory> {
  const { data } = await api.get<ClientHistory>(`/clients/${clientId}/history`, {
    params: {
      ...(options?.limit ? { limit: options.limit } : {}),
      ...(options?.before ? { before: options.before } : {}),
    },
  })
  return data
}

export async function createContact(
  clientId: string,
  payload: ContactCreate,
): Promise<ContactRead> {
  const { data } = await api.post<ContactRead>(
    `/clients/${clientId}/contacts`,
    payload,
  )
  return data
}

export async function listContacts(
  clientId: string,
): Promise<{ items: ContactRead[] }> {
  const { data } = await api.get<{ items: ContactRead[] }>(
    `/clients/${clientId}/contacts`,
  )
  return data
}

export async function deleteContact(
  clientId: string,
  contactId: string,
): Promise<void> {
  await api.delete(`/clients/${clientId}/contacts/${contactId}`)
}

export type CreateClientWithContactsResult = {
  client: ClientDetail
  failedContacts: number
}

export async function createClientWithContacts(
  payload: ClientCreate,
  contacts: ContactCreate[],
): Promise<CreateClientWithContactsResult> {
  const created = await createClient(payload)
  let failedContacts = 0
  for (const contact of contacts) {
    try {
      await createContact(created.id, contact)
    } catch {
      failedContacts += 1
    }
  }
  let client: ClientDetail
  try {
    client = await getClient(created.id)
  } catch {
    client = { ...created, contacts: [] }
  }
  return { client, failedContacts }
}
