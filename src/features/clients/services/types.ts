export const DOCUMENT_TYPES = ['cedula', 'pasaporte'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const CLIENT_STATUSES = ['active', 'blocked'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export type ClientReference = {
  name: string
  phone: string
  relationship: string
}

export type ClientGuarantor = {
  first_name: string
  last_name: string
  document_type: DocumentType
  document_number: string
  phone: string
  relationship: string
}

export type ClientListItem = {
  id: string
  full_name: string
  document_type: DocumentType
  document_number: string
  phone: string
  status: ClientStatus
  collector_name: string | null
}

export type ClientRead = ClientListItem & {
  first_name: string
  last_name: string
  email: string | null
  address: string | null
  notes: string | null
  collector_id: string | null
  blocked_reason: string | null
  references: ClientReference[]
  guarantors: ClientGuarantor[]
  created_at: string
  updated_at: string
}

export type ClientWrite = {
  first_name: string
  last_name: string
  document_type: DocumentType
  document_number: string
  phone: string
  email?: string | null
  address?: string | null
  notes?: string | null
  collector_id?: string | null
  references: ClientReference[]
  guarantors: ClientGuarantor[]
}

export type ClientSearchRequest = {
  query: string
  cursor?: string | null
  limit?: number
}

export type CursorPage<T> = {
  items: T[]
  next_cursor: string | null
}

export type ClientHistoryEvent = {
  id: string
  occurred_at: string
  actor_name: string
  summary: string
}

export type BlockClientRequest = {
  reason: string
}
