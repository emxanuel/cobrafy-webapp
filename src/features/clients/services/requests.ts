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
  ContactDraft,
  ContactRead,
  ContactUpdate,
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

export async function updateContact(
  clientId: string,
  contactId: string,
  payload: ContactUpdate,
): Promise<ContactRead> {
  const { data } = await api.patch<ContactRead>(
    `/clients/${clientId}/contacts/${contactId}`,
    payload,
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
  failedContactNames: string[]
}

function toContactCreate(item: ContactDraft): ContactCreate {
  return {
    type: item.type,
    name: item.name,
    phone: item.phone,
    relationship: item.relationship,
    address: item.address ?? null,
    doc_type: item.doc_type ?? null,
    document: item.document ?? null,
  }
}

function contactUnchanged(previous: ContactRead, next: ContactDraft): boolean {
  return (
    previous.type === next.type &&
    previous.name === next.name &&
    previous.phone === next.phone &&
    previous.relationship === next.relationship &&
    (previous.address ?? '') === (next.address ?? '') &&
    (previous.doc_type ?? null) === (next.doc_type ?? null) &&
    (previous.document ?? '') === (next.document ?? '')
  )
}

export async function saveContactsDiff(
  clientId: string,
  previous: ContactRead[],
  next: ContactDraft[],
): Promise<string[]> {
  const prevActive = previous.filter((item) => item.is_active)
  const prevById = new Map(prevActive.map((item) => [item.id, item]))
  const keptIds = new Set(next.map((item) => item.id).filter((id): id is string => Boolean(id)))
  const failedNames: string[] = []

  for (const item of next) {
    const label = item.name.trim() || 'contacto'
    try {
      const existing = item.id ? prevById.get(item.id) : undefined
      if (!existing) {
        await createContact(clientId, toContactCreate(item))
        continue
      }
      if (!contactUnchanged(existing, item)) {
        await updateContact(clientId, existing.id, toContactCreate(item))
      }
    } catch {
      failedNames.push(label)
    }
  }

  for (const item of prevActive) {
    if (keptIds.has(item.id)) continue
    try {
      await deleteContact(clientId, item.id)
    } catch {
      failedNames.push(item.name)
    }
  }

  return failedNames
}

async function reloadClient(created: ClientRead): Promise<ClientDetail> {
  try {
    return await getClient(created.id)
  } catch {
    return { ...created, contacts: [] }
  }
}

export async function createClientWithContacts(
  payload: ClientCreate,
  contacts: ContactCreate[],
): Promise<CreateClientWithContactsResult> {
  const created = await createClient(payload)
  const failedContactNames = await saveContactsDiff(created.id, [], contacts)
  const client = await reloadClient(created)
  return {
    client,
    failedContacts: failedContactNames.length,
    failedContactNames,
  }
}

export async function updateClientWithContacts(
  clientId: string,
  payload: ClientUpdate,
  previousContacts: ContactRead[],
  contacts: ContactDraft[],
): Promise<CreateClientWithContactsResult> {
  const saved = await updateClient(clientId, payload)
  const failedContactNames = await saveContactsDiff(clientId, previousContacts, contacts)
  const client = await reloadClient(saved)
  return {
    client,
    failedContacts: failedContactNames.length,
    failedContactNames,
  }
}
