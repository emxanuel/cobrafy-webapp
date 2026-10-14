import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { auditKeys } from '@/features/audit/query-keys'
import { listAudit } from '@/features/audit/services/requests'
import { AUDIT_PAGE_SIZE, type AuditFilters } from '@/features/audit/services/types'
import { useBusinessStore } from '@/features/business/stores/business-store'

export function useAuditQuery(filters: AuditFilters, page: number, enabled: boolean) {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useQuery({
    queryKey: auditKeys.list(businessId, filters, page),
    queryFn: () =>
      listAudit({
        ...filters,
        page,
        page_size: AUDIT_PAGE_SIZE,
      }),
    enabled: enabled && Boolean(businessId),
    placeholderData: keepPreviousData,
  })
}
