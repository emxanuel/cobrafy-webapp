import { api } from '@/features/shared/services/client'
import type {
  BlockClientRequest,
  ClientHistoryEvent,
  ClientRead,
  ClientSearchRequest,
  ClientWrite,
  CursorPage,
} from './types'

export async function searchClients(
  payload: ClientSearchRequest,
): Promise<CursorPage<ClientRead>> {
  const { data } = await api.post<CursorPage<ClientRead>>('/clients/search', payload)
  return data
}

export async function getClient(clientId: string): Promise<ClientRead> {
  const { data } = await api.get<ClientRead>(`/clients/${clientId}`)
  return data
}

export async function createClient(payload: ClientWrite): Promise<ClientRead> {
  const { data } = await api.post<ClientRead>('/clients', payload)
  return data
}

export async function updateClient(
  clientId: string,
  payload: ClientWrite,
): Promise<ClientRead> {
  const { data } = await api.patch<ClientRead>(`/clients/${clientId}`, payload)
  return data
}

export async function blockClient(
  clientId: string,
  payload: BlockClientRequest,
): Promise<ClientRead> {
  const { data } = await api.post<ClientRead>(`/clients/${clientId}/block`, payload)
  return data
}

export async function unblockClient(clientId: string): Promise<ClientRead> {
  const { data } = await api.post<ClientRead>(`/clients/${clientId}/unblock`)
  return data
}

export async function getClientHistory(
  clientId: string,
  cursor?: string | null,
): Promise<CursorPage<ClientHistoryEvent>> {
  const { data } = await api.get<CursorPage<ClientHistoryEvent>>(
    `/clients/${clientId}/history`,
    { params: cursor ? { cursor } : undefined },
  )
  return data
}
