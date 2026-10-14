import { toClientPatch } from '@/features/clients/lib/client-patch'
import {
  contactUnchanged,
  toContactCreate,
  toContactPatch,
} from '@/features/clients/lib/contact-patch'
import {
  persistContactsSaveNotice,
  type ContactsSaveNotice,
  type FailedContact,
} from '@/features/clients/lib/failed-contacts-notice'
import { isApiError } from '@/features/shared/lib/api-error'
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
  failed: FailedContact[]
  applied: FailedContact[]
  stoppedOnUnauthorized: boolean
}

function toCreateResult(client: ClientDetail, notice: ContactsSaveNotice): CreateClientWithContactsResult {
  persistContactsSaveNotice(notice)
  return {
    client,
    failedContacts: notice.failed.length,
    failedContactNames: notice.failed.map((item) => item.name),
    failed: notice.failed,
    applied: notice.applied,
    stoppedOnUnauthorized: notice.stoppedOnUnauthorized,
  }
}

function isUnauthorized(error: unknown) {
  return isApiError(error) && error.status === 401
}

export async function saveContactsDiff(
  clientId: string,
  previous: ContactRead[],
  next: ContactDraft[],
): Promise<ContactsSaveNotice> {
  const prevActive = previous.filter((item) => item.is_active)
  const prevById = new Map(prevActive.map((item) => [item.id, item]))
  const keptIds = new Set(next.map((item) => item.id).filter((id): id is string => Boolean(id)))
  const failed: FailedContact[] = []
  const applied: FailedContact[] = []
  let stoppedOnUnauthorized = false

  async function run(op: () => Promise<unknown>, row: FailedContact): Promise<'stop' | 'continue'> {
    try {
      await op()
      applied.push(row)
      return 'continue'
    } catch (error) {
      failed.push(row)
      if (isUnauthorized(error)) {
        stoppedOnUnauthorized = true
        persistContactsSaveNotice({ failed, applied, stoppedOnUnauthorized })
        return 'stop'
      }
      return 'continue'
    }
  }

  for (const item of prevActive) {
    if (keptIds.has(item.id)) continue
    const outcome = await run(
      () => deleteContact(clientId, item.id),
      { name: item.name, op: 'remove' },
    )
    if (outcome === 'stop') return { failed, applied, stoppedOnUnauthorized }
  }

  const toCreate: ContactDraft[] = []
  for (const item of next) {
    const label = item.name.trim() || 'contacto'
    if (item.id && !prevById.has(item.id)) {
      failed.push({ name: label, op: 'edit' })
      continue
    }
    const existing = item.id ? prevById.get(item.id) : undefined
    if (!existing) {
      toCreate.push(item)
      continue
    }
    if (contactUnchanged(existing, item)) continue
    const outcome = await run(
      () => updateContact(clientId, existing.id, toContactPatch(existing, item)),
      { name: label, op: 'edit' },
    )
    if (outcome === 'stop') return { failed, applied, stoppedOnUnauthorized }
  }

  for (const item of toCreate) {
    const label = item.name.trim() || 'contacto'
    const outcome = await run(
      () => createContact(clientId, toContactCreate(item)),
      { name: label, op: 'add' },
    )
    if (outcome === 'stop') return { failed, applied, stoppedOnUnauthorized }
  }

  return { failed, applied, stoppedOnUnauthorized }
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
  contacts: ContactDraft[],
): Promise<CreateClientWithContactsResult> {
  const created = await createClient(payload)
  const notice = await saveContactsDiff(created.id, [], contacts)
  const client = await reloadClient(created)
  return toCreateResult(client, notice)
}

export async function updateClientWithContacts(
  clientId: string,
  payload: ClientCreate,
  previousContacts: ContactRead[],
  contacts: ContactDraft[],
  previousClient: ClientRead,
): Promise<CreateClientWithContactsResult> {
  const patch = toClientPatch(previousClient, payload)
  const saved =
    Object.keys(patch).length > 0
      ? await updateClient(clientId, patch)
      : previousClient
  const notice = await saveContactsDiff(clientId, previousContacts, contacts)
  const client = await reloadClient(saved)
  return toCreateResult(client, notice)
}
