import type { AuditFilters } from './services/types'

export const auditKeys = {
  all: ['audit'] as const,
  list: (businessId: string | null, filters: AuditFilters, page: number) =>
    [...auditKeys.all, businessId, filters, page] as const,
}
