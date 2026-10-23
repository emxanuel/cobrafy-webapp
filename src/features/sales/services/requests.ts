import { api, CREATE_SALE_TIMEOUT_MS } from '@/features/shared/services/client'
import {
  FREQUENCIES,
  type CreditSettings,
  type CreditSettingsLateFees,
  type CreditSettingsWrite,
  type Frequency,
  type InstallmentPreview,
  type InstallmentRead,
  type LateFeeKind,
  type SaleContract,
  type SaleContractSeller,
  type SaleCreateRequest,
  type SaleDetail,
  type SalePage,
  type SaleRead,
  type SaleVoidedBy,
  type SaleWarning,
  type SimulateSaleRequest,
  type SimulateSaleResponse,
  type SurchargeKind,
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

function asSurchargeKind(value: unknown): SurchargeKind {
  return value === 'fixed_amount' ? 'fixed_amount' : 'percent_of_financed'
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
      status: asString(item.status, 'pending'),
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

function hasOwn(row: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, key)
}

function isLateFeeKind(value: unknown): value is LateFeeKind {
  return value === 'percent' || value === 'fixed' || value === null
}

function isPassthroughAmount(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/** Echo GET mora fields as-is. Missing keys stay missing — never invent values. */
export function echoLateFeeFields(
  source: object | null | undefined,
): Partial<CreditSettingsLateFees> {
  if (source == null) return {}
  const row = source as Record<string, unknown>
  const out: Partial<CreditSettingsLateFees> = {}
  if (hasOwn(row, 'late_fee_kind') && isLateFeeKind(row.late_fee_kind)) {
    out.late_fee_kind = row.late_fee_kind
  }
  if (hasOwn(row, 'late_fee_percent') && isPassthroughAmount(row.late_fee_percent)) {
    out.late_fee_percent = row.late_fee_percent
  }
  if (hasOwn(row, 'late_fee_fixed') && isPassthroughAmount(row.late_fee_fixed)) {
    out.late_fee_fixed = row.late_fee_fixed
  }
  if (
    hasOwn(row, 'late_fee_grace_days') &&
    typeof row.late_fee_grace_days === 'number' &&
    Number.isInteger(row.late_fee_grace_days)
  ) {
    out.late_fee_grace_days = row.late_fee_grace_days
  }
  if (hasOwn(row, 'late_fee_cap') && isPassthroughAmount(row.late_fee_cap)) {
    out.late_fee_cap = row.late_fee_cap
  }
  return out
}

export function normalizeCreditSettings(data: unknown): CreditSettings {
  const row = (data ?? {}) as Record<string, unknown>
  const rawFreq = row.allowed_frequencies
  const allowed = Array.isArray(rawFreq)
    ? rawFreq.filter((item): item is Frequency => FREQUENCIES.includes(item as Frequency))
    : [...FREQUENCIES]
  return {
    interest_method: asString(row.interest_method, 'recargo_fijo'),
    surcharge_kind: asSurchargeKind(row.surcharge_kind),
    surcharge_percent: asNullableString(row.surcharge_percent),
    surcharge_amount: asNullableString(row.surcharge_amount),
    allowed_frequencies: allowed.length ? allowed : [...FREQUENCIES],
    max_installments: asInt(row.max_installments, 24) || 24,
    min_down_payment_percent: asNullableString(row.min_down_payment_percent),
    ...(typeof row.configured === 'boolean' ? { configured: row.configured } : {}),
    ...echoLateFeeFields(row),
  }
}

function asSeller(value: unknown): SaleContractSeller | undefined {
  if (typeof value !== 'object' || value == null) return undefined
  const row = value as Record<string, unknown>
  const membershipId = asString(row.membership_id)
  const name = asString(row.name)
  if (!membershipId && !name) return undefined
  return { membership_id: membershipId, name }
}

function asContract(value: unknown): SaleContract {
  if (typeof value !== 'object' || value == null) return {}
  const row = value as SaleContract
  const seller = asSeller((value as Record<string, unknown>).seller)
  return seller ? { ...row, seller } : row
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
    balance: typeof row.balance === 'string' ? row.balance : null,
    surcharge_kind: asSurchargeKind(row.surcharge_kind),
    surcharge_percent: asNullableString(row.surcharge_percent),
    surcharge_amount: asNullableString(row.surcharge_amount),
    interest_method: asString(row.interest_method, 'recargo_fijo'),
    frequency: asFrequency(row.frequency),
    installments_count: asInt(row.installments_count, 0),
    anchor_date: asString(row.anchor_date),
    anchor_offset: asInt(row.anchor_offset, 0),
    first_due_date: asString(row.first_due_date),
    status: asString(row.status, 'active'),
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
    contract: asContract(row.contract),
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
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CREATE_SALE_TIMEOUT_MS)
  try {
    const { data } = await api.post<unknown>('/sales', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
      timeout: CREATE_SALE_TIMEOUT_MS,
      signal: controller.signal,
    })
    return normalizeSaleDetail(data)
  } finally {
    window.clearTimeout(timer)
  }
}

function trimCreditAmount(value: string | null): string | null {
  if (value == null) return null
  return value.trim()
}

/**
 * CreditSettingsWrite only. Never forward GET `configured` — extra keys 422.
 * Re-sends the 5 mora fields only when the GET (or caller) already had them.
 */
export function toCreditSettingsWrite(
  payload: CreditSettings | CreditSettingsWrite,
): CreditSettingsWrite {
  return {
    interest_method: payload.interest_method,
    surcharge_kind: payload.surcharge_kind,
    surcharge_percent: trimCreditAmount(payload.surcharge_percent),
    surcharge_amount: trimCreditAmount(payload.surcharge_amount),
    allowed_frequencies: payload.allowed_frequencies,
    max_installments: payload.max_installments,
    min_down_payment_percent: payload.min_down_payment_percent,
    ...echoLateFeeFields(payload),
  }
}

export function buildCreditSettingsWrite(
  input: {
    surcharge_kind: CreditSettingsWrite['surcharge_kind']
    surcharge_percent: string
    surcharge_amount: string
    allowed_frequencies: CreditSettingsWrite['allowed_frequencies']
    max_installments: number
    min_down_payment_percent: string
  },
  fromGet?: CreditSettings,
): CreditSettingsWrite {
  return toCreditSettingsWrite({
    interest_method: 'recargo_fijo',
    surcharge_kind: input.surcharge_kind,
    surcharge_percent:
      input.surcharge_kind === 'percent_of_financed' ? input.surcharge_percent : null,
    surcharge_amount: input.surcharge_kind === 'fixed_amount' ? input.surcharge_amount : null,
    allowed_frequencies: input.allowed_frequencies,
    max_installments: input.max_installments,
    min_down_payment_percent: input.min_down_payment_percent.trim()
      ? input.min_down_payment_percent.trim()
      : null,
    ...echoLateFeeFields(fromGet),
  })
}

export async function putCreditSettings(
  businessId: string,
  payload: CreditSettings | CreditSettingsWrite,
): Promise<CreditSettings> {
  const { data } = await api.put<unknown>(
    `/businesses/${businessId}/credit-settings`,
    toCreditSettingsWrite(payload),
  )
  return normalizeCreditSettings(data)
}

export async function listSales(params?: {
  page?: number
  page_size?: number
  client_id?: string
  status?: 'active' | 'voided'
}): Promise<SalePage> {
  const { data } = await api.get<unknown>('/sales', { params })
  const row = (data ?? {}) as Record<string, unknown>
  const items = Array.isArray(row.items) ? row.items.map(normalizeSale) : []
  return {
    items,
    total: asInt(row.total, 0),
    page: asInt(row.page, 1) || 1,
    page_size: asInt(row.page_size, 50) || 50,
  }
}

export async function listClientSales(clientId: string): Promise<SaleRead[]> {
  const { data } = await api.get<unknown>(`/clients/${clientId}/sales`)
  const items = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown }).items)
      ? ((data as { items: unknown[] }).items)
      : []
  return items.map(normalizeSale)
}

export async function getSale(saleId: string): Promise<SaleDetail> {
  const { data } = await api.get<unknown>(`/sales/${saleId}`)
  return normalizeSaleDetail(data)
}

export function filenameFromDisposition(header: string): string | null {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf?.[1]) return decodeURIComponent(utf[1])
  const plain = /filename="?([^"]+)"?/i.exec(header)
  return plain?.[1] ?? null
}

export async function voidSale(saleId: string, reason: string): Promise<SaleDetail> {
  const { data } = await api.post<unknown>(`/sales/${saleId}/void`, { reason })
  return normalizeSaleDetail(data)
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
