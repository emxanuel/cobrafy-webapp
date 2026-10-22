import { toClientPatch } from '@/features/clients/lib/client-patch'
import {
  contactUnchanged,
  toContactCreate,
  toContactPatch,
} from '@/features/clients/lib/contact-patch'
import {
  PartialClientSaveError,
  remapContactDocumentError,
} from '@/features/clients/lib/document-field-errors'
import {
  persistContactsSaveNotice,
  type ContactsSaveNotice,
  type FailedContact,
} from '@/features/clients/lib/failed-contacts-notice'
import { isApiError, type ApiError } from '@/features/shared/lib/api-error'
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
  try {
    await api.delete(`/clients/${clientId}/contacts/${contactId}`)
  } catch (error) {
    if (isApiError(error) && error.status === 404) return
    throw error
  }
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

export type SaveContactsDiffResult = ContactsSaveNotice & {
  createdByIndex: Record<number, ContactRead>
  removedIds: string[]
  documentError: ApiError | null
}

export async function saveContactsDiff(
  clientId: string,
  previous: ContactRead[],
  next: ContactDraft[],
): Promise<SaveContactsDiffResult> {
  const prevActive = previous.filter((item) => item.is_active)
  const prevById = new Map(prevActive.map((item) => [item.id, item]))
  const keptIds = new Set(next.map((item) => item.id).filter((id): id is string => Boolean(id)))
  const failed: FailedContact[] = []
  const applied: FailedContact[] = []
  const createdByIndex: Record<number, ContactRead> = {}
  const removedIds: string[] = []
  let documentError: ApiError | null = null
  let stoppedOnUnauthorized = false

  async function run<T>(
    op: () => Promise<T>,
    row: FailedContact,
    formIndex?: number,
  ): Promise<{ status: 'stop' | 'continue'; value?: T }> {
    try {
      const value = await op()
      applied.push(row)
      return { status: 'continue', value }
    } catch (error) {
      if (formIndex !== undefined) {
        const remapped = remapContactDocumentError(error, formIndex)
        if (remapped) {
          documentError = remapped
          return { status: 'stop' }
        }
      }
      failed.push(row)
      if (isUnauthorized(error)) {
        stoppedOnUnauthorized = true
        persistContactsSaveNotice({ failed, applied, stoppedOnUnauthorized })
        return { status: 'stop' }
      }
      return { status: 'continue' }
    }
  }

  function snapshot(): SaveContactsDiffResult {
    return { failed, applied, stoppedOnUnauthorized, createdByIndex, removedIds, documentError }
  }

  for (const item of prevActive) {
    if (keptIds.has(item.id)) continue
    const appliedCount = applied.length
    const outcome = await run(
      () => deleteContact(clientId, item.id),
      { name: item.name, op: 'remove' },
    )
    if (applied.length > appliedCount) removedIds.push(item.id)
    if (outcome.status === 'stop') return snapshot()
  }

  const toCreate: Array<{ item: ContactDraft; index: number }> = []
  for (const [index, item] of next.entries()) {
    const label = item.name.trim() || 'contacto'
    if (item.id && !prevById.has(item.id)) {
      failed.push({ name: label, op: 'edit' })
      continue
    }
    const existing = item.id ? prevById.get(item.id) : undefined
    if (!existing) {
      toCreate.push({ item, index })
      continue
    }
    if (contactUnchanged(existing, item)) continue
    const outcome = await run(
      () => updateContact(clientId, existing.id, toContactPatch(existing, item)),
      { name: label, op: 'edit' },
      index,
    )
    if (outcome.status === 'stop') return snapshot()
  }

  for (const { item, index } of toCreate) {
    const label = item.name.trim() || 'contacto'
    const outcome = await run(
      () => createContact(clientId, toContactCreate(item)),
      { name: label, op: 'add' },
      index,
    )
    if (outcome.value) createdByIndex[index] = outcome.value
    if (outcome.status === 'stop') return snapshot()
  }

  return snapshot()
}

async function reloadClient(created: ClientRead): Promise<ClientDetail> {
  try {
    return await getClient(created.id)
  } catch {
    return { ...created, contacts: [] }
  }
}

function throwIfDocumentError(
  diff: SaveContactsDiffResult,
  savedClient: ClientRead,
) {
  if (!diff.documentError) return
  throw new PartialClientSaveError(
    diff.documentError,
    savedClient,
    diff.createdByIndex,
    diff.removedIds,
  )
}

export async function createClientWithContacts(
  payload: ClientCreate,
  contacts: ContactDraft[],
): Promise<CreateClientWithContactsResult> {
  const created = await createClient(payload)
  const diff = await saveContactsDiff(created.id, [], contacts)
  throwIfDocumentError(diff, created)
  const client = await reloadClient(created)
  return toCreateResult(client, diff)
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
  const diff = await saveContactsDiff(clientId, previousContacts, contacts)
  throwIfDocumentError(diff, saved)
  const client = await reloadClient(saved)
  return toCreateResult(client, diff)
}
