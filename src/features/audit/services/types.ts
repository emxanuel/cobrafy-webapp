export const AUDIT_PAGE_SIZE = 20

export type AuditRead = {
  id: string
  business_id: string
  user_id: string | null
  membership_id: string | null
  action: string
  entity: string
  entity_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

export type AuditPage = {
  items: AuditRead[]
  total: number
  page: number
  page_size: number
}

export type AuditFilters = {
  entity?: string
  user_id?: string
  from?: string
  to?: string
}

export type AuditListParams = AuditFilters & {
  page?: number
  page_size?: number
}
