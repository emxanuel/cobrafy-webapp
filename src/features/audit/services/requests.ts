import { api } from '@/features/shared/services/client'
import type { AuditListParams, AuditPage } from './types'

export async function listAudit(params: AuditListParams): Promise<AuditPage> {
  const { data } = await api.get<AuditPage>('/audit', { params })
  return data
}
