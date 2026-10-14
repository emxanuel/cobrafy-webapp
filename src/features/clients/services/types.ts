export const DOCUMENT_TYPES = ['cedula', 'pasaporte'] as const
export type DocType = (typeof DOCUMENT_TYPES)[number]

export const CLIENT_STATUSES = ['active', 'blocked'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const CONTACT_TYPES = ['referencia', 'garante'] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export const HISTORY_EVENT_TYPES = [
  'blocked',
  'unblocked',
  'collector_assigned',
  'collector_reassigned',
] as const
export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number]

export type ContactRead = {
  id: string
  client_id: string
  type: ContactType
  name: string
  phone: string
  relationship: string
  address: string | null
  doc_type: DocType | null
  document: string | null
  has_document: boolean
  document_available: boolean
  is_active: boolean
}

export type ContactCreate = {
  type: ContactType
  name: string
  phone: string
  relationship: string
  address?: string | null
  doc_type?: DocType | null
  document?: string | null
}

export type ContactUpdate = {
  type?: ContactType
  name?: string
  phone?: string
  relationship?: string
  address?: string | null
  doc_type?: DocType | null
  document?: string | null
}

export type ContactDraft = Omit<ContactCreate, 'doc_type'> & {
  id?: string
  doc_type?: DocType | '' | null
}

export type ClientRead = {
  id: string
  name: string
  doc_type: DocType
  document: string | null
  document_available: boolean
  phone: string
  address: string
  notes: string | null
  collector_membership_id: string | null
  status: ClientStatus
  is_blocked: boolean
  blocked_reason: string | null
}

export type ClientDetail = ClientRead & {
  contacts: ContactRead[]
}

export type ClientCreate = {
  name: string
  doc_type: DocType
  document: string
  phone: string
  address: string
  notes?: string | null
  collector_membership_id?: string | null
}

export type ClientUpdate = {
  name?: string
  doc_type?: DocType
  document?: string
  phone?: string
  address?: string
  notes?: string | null
  collector_membership_id?: string | null
}

export type ClientPage = {
  items: ClientRead[]
  total: number
  page: number
  page_size: number
}

export type ClientSearchRequest = {
  document?: string | null
  q?: string | null
  phone?: string | null
  name?: string | null
  page?: number
  page_size?: number
}

export type ClientCheckRequest = {
  doc_type: DocType
  document: string
}

export type ClientCheckRead = {
  found: boolean
  is_blocked: boolean
  blocked_reason: string | null
  client_id: string | null
}

export type ClientReason = {
  reason: string
}

export type HistoryActor = {
  user_id: string | null
  membership_id: string | null
}

export type HistoryEvent = {
  id: string
  type: HistoryEventType
  occurred_at: string
  actor: HistoryActor
  reason: string | null
  from_collector_membership_id: string | null
  to_collector_membership_id: string | null
}

export type ClientHistory = {
  purchases: unknown[]
  payments: unknown[]
  overdue: unknown[]
  follow_ups: unknown[]
  events: HistoryEvent[]
  next_cursor: string | null
}
