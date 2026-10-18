import { api } from '@/features/shared/services/client'
import {
  FREQUENCIES,
  type CreditSettings,
  type Frequency,
  type InstallmentPreview,
  type InstallmentRead,
  type SaleCreateRequest,
  type SaleDetail,
  type SalePage,
  type SaleRead,
  type SaleVoidedBy,
  type SaleWarning,
  type SimulateSaleRequest,
  type SimulateSaleResponse,
  type SurchargeMode,
} from './types'

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    let n = 0
    const negative = value.startsWith('-')
    for (const ch of negative ? value.slice(1) : value) {
      n = n * 10 + (ch.charCodeAt(0) - 48)
    }
    return negative ? -n : n
  }
  return fallback
}

function asFrequency(value: unknown): Frequency {
  return FREQUENCIES.includes(value as Frequency) ? (value as Frequency) : 'mensual'
}

function asMode(value: unknown): SurchargeMode {
  if (value === 'fixed' || value === 'monto_fijo') return 'fixed'
  return 'percent'
}

function asWarnings(value: unknown): SaleWarning[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item != null)
    .map((item) => ({
      code: asString(item.code),
      message: asString(item.message),
    }))
}

function asPreview(value: unknown): InstallmentPreview[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item != null)
    .map((item) => ({
      number: asInt(item.number, 0),
      due_date: asString(item.due_date),
      amount: asString(item.amount),
    }))
}

function asInstallments(value: unknown): InstallmentRead[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item != null)
    .map((item) => ({
      number: asInt(item.number, 0),
      due_date: asString(item.due_date),
      amount: asString(item.amount),
      paid: asString(item.paid, '0.00'),
      late_fee: asString(item.late_fee, '0.00'),
      status: asString(item.status, 'pendiente'),
    }))
}

function asVoidedBy(value: unknown): SaleVoidedBy | null {
  if (typeof value !== 'object' || value == null) return null
  const row = value as Record<string, unknown>
  const membershipId = asString(row.membership_id)
  if (!membershipId) return null
  return { membership_id: membershipId, name: asString(row.name) }
}

function asNullableString(value: unknown): string | null {
  const text = asString(value)
  return text || null
}

export function normalizeCreditSettings(data: unknown): CreditSettings {
  const row = (data ?? {}) as Record<string, unknown>
  const rawFreq = row.allowed_frequencies
  const allowed = Array.isArray(rawFreq)
    ? rawFreq.filter((item): item is Frequency => FREQUENCIES.includes(item as Frequency))
    : [...FREQUENCIES]
  return {
    interest_method: asString(row.interest_method, 'recargo_fijo'),
    surcharge_mode: asMode(row.surcharge_mode),
    surcharge_percent: asNullableString(row.surcharge_percent),
    surcharge_amount: asNullableString(row.surcharge_amount),
    allowed_frequencies: allowed.length ? allowed : [...FREQUENCIES],
    max_installments: asInt(row.max_installments, 24) || 24,
    min_down_payment_percent: asNullableString(row.min_down_payment_percent),
  }
}

export function normalizeSimulation(data: unknown): SimulateSaleResponse {
  const row = (data ?? {}) as Record<string, unknown>
  const installments = asPreview(row.installments)
  return {
    financed: asString(row.financed, '0.00'),
    surcharge: asString(row.surcharge, '0.00'),
    total: asString(row.total, '0.00'),
    installment_amount: asString(row.installment_amount, '0.00'),
    installments,
    settings_configured: row.settings_configured !== false,
    anchor_date: asString(row.anchor_date),
    anchor_offset: asInt(row.anchor_offset, 0),
    warnings: asWarnings(row.warnings),
  }
}

export function normalizeSale(data: unknown): SaleRead {
  const row = (data ?? {}) as Record<string, unknown>
  const clientRaw = (row.client ?? {}) as Record<string, unknown>
  return {
    id: asString(row.id),
    sale_number: asInt(row.sale_number, 0),
    client_id: asString(row.client_id) || asString(clientRaw.id),
    client: {
      id: asString(clientRaw.id) || asString(row.client_id),
      name: asString(clientRaw.name),
    },
    seller_membership_id: asString(row.seller_membership_id),
    item_description: asString(row.item_description),
    price: asString(row.price, '0.00'),
    down_payment: asString(row.down_payment, '0.00'),
    financed: asString(row.financed, '0.00'),
    surcharge: asString(row.surcharge, '0.00'),
    total: asString(row.total, '0.00'),
    surcharge_kind: asString(row.surcharge_kind, 'percent'),
    surcharge_percent: asNullableString(row.surcharge_percent),
    surcharge_amount: asNullableString(row.surcharge_amount),
    interest_method: asString(row.interest_method, 'recargo_fijo'),
    frequency: asFrequency(row.frequency),
    installments_count: asInt(row.installments_count, 0),
    anchor_date: asString(row.anchor_date),
    anchor_offset: asInt(row.anchor_offset, 0),
    first_due_date: asString(row.first_due_date),
    status: asString(row.status, 'activa'),
    voided_at: asNullableString(row.voided_at),
    void_reason: asNullableString(row.void_reason),
    voided_by: asVoidedBy(row.voided_by),
    created_at: asString(row.created_at),
  }
}

export function normalizeSaleDetail(data: unknown): SaleDetail {
  const row = (data ?? {}) as Record<string, unknown>
  return {
    ...normalizeSale(row),
    installments: asInstallments(row.installments),
    contract:
      typeof row.contract === 'object' && row.contract != null
        ? (row.contract as Record<string, unknown>)
        : {},
    warnings: asWarnings(row.warnings),
  }
}

export async function getCreditSettings(businessId: string): Promise<CreditSettings> {
  const { data } = await api.get<unknown>(`/businesses/${businessId}/credit-settings`)
  return normalizeCreditSettings(data)
}

export async function simulateSale(payload: SimulateSaleRequest): Promise<SimulateSaleResponse> {
  const { data } = await api.post<unknown>('/sales/simulate', payload)
  return normalizeSimulation(data)
}

export async function createSale(
  payload: SaleCreateRequest,
  idempotencyKey: string,
): Promise<SaleDetail> {
  // Send Idempotency-Key only. Do not read Idempotent-Replayed: CORS has no
  // expose_headers yet (CBF-212). Success is the JSON body / status.
  const { data } = await api.post<unknown>('/sales', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
  return normalizeSaleDetail(data)
}

export async function listSales(params?: {
  page?: number
  page_size?: number
  client_id?: string
}): Promise<SalePage> {
  const { data } = await api.get<SalePage>('/sales', { params })
  return {
    ...data,
    items: (data.items ?? []).map(normalizeSale),
  }
}

function filenameFromDisposition(header: string): string | null {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf?.[1]) return decodeURIComponent(utf[1])
  const plain = /filename="?([^"]+)"?/i.exec(header)
  return plain?.[1] ?? null
}

export async function downloadSaleContract(
  saleId: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await api.get<Blob>(`/sales/${saleId}/contract.pdf`, {
    responseType: 'blob',
  })
  const disposition = String(response.headers['content-disposition'] ?? '')
  return {
    blob: response.data,
    filename: filenameFromDisposition(disposition) ?? `contrato-venta-${saleId}.pdf`,
  }
}
