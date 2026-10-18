import { api } from '@/features/shared/services/client'
import type { BusinessPatch, BusinessRead } from './types'

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  const text = asString(value)
  return text || null
}

export function normalizeBusiness(data: unknown): BusinessRead {
  const row = (data ?? {}) as Record<string, unknown>
  return {
    id: asString(row.id),
    name: asString(row.name),
    phone: asNullableString(row.phone),
    rnc: asNullableString(row.rnc),
    address: asNullableString(row.address),
    currency: asString(row.currency, 'DOP'),
    timezone: asString(row.timezone, 'America/Santo_Domingo'),
  }
}

export async function getBusiness(businessId: string): Promise<BusinessRead> {
  const { data } = await api.get<unknown>(`/businesses/${businessId}`)
  return normalizeBusiness(data)
}

export async function patchBusiness(
  businessId: string,
  payload: BusinessPatch,
): Promise<BusinessRead> {
  const { data } = await api.patch<unknown>(`/businesses/${businessId}`, payload)
  return normalizeBusiness(data)
}
