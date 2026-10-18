import { api } from '@/features/shared/services/client'
import { FREQUENCIES, type CreditSettings, type Frequency, type PlanInstallment, type SaleCreateRequest, type SalePage, type SaleRead, type SaleWarning, type SimulateSaleRequest, type SimulateSaleResponse, type SurchargeMode } from './types'

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

function asPlan(value: unknown): PlanInstallment[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item != null)
    .map((item) => ({
      number: asInt(item.number ?? item.n, 0),
      due_date: asString(item.due_date ?? item.date),
      amount: asString(item.amount),
    }))
}

function pickPlan(data: Record<string, unknown>): PlanInstallment[] {
  if (Array.isArray(data.installments)) return asPlan(data.installments)
  if (Array.isArray(data.plan)) return asPlan(data.plan)
  if (Array.isArray(data.schedule)) return asPlan(data.schedule)
  return []
}

export function normalizeCreditSettings(data: unknown): CreditSettings {
  const row = (data ?? {}) as Record<string, unknown>
  const rawFreq = row.allowed_frequencies
  const allowed = Array.isArray(rawFreq)
    ? rawFreq.filter((item): item is Frequency => FREQUENCIES.includes(item as Frequency))
    : [...FREQUENCIES]
  return {
    interest_method: asString(row.interest_method, 'recargo_fijo'),
    surcharge_mode: asMode(row.surcharge_mode ?? row.surcharge_type ?? row.recargo_tipo),
    surcharge_percent: asString(row.surcharge_percent ?? row.recargo_porcentaje) || null,
    surcharge_amount: asString(row.surcharge_amount ?? row.surcharge_fixed_amount) || null,
    allowed_frequencies: allowed.length ? allowed : [...FREQUENCIES],
    max_installments: asInt(row.max_installments ?? row.plazo_max, 24) || 24,
    min_down_payment_percent:
      asString(row.min_down_payment_percent ?? row.inicial_minima_porcentaje) || null,
  }
}

export function normalizeSimulation(data: unknown): SimulateSaleResponse {
  const row = (data ?? {}) as Record<string, unknown>
  const plan = pickPlan(row)
  const count =
    asInt(row.installment_count) ||
    (typeof row.installments === 'number' ? row.installments : plan.length)
  return {
    settings_configured: row.settings_configured !== false,
    financed_balance: asString(row.financed_balance ?? row.saldo_financiado, '0.00'),
    surcharge: asString(row.surcharge ?? row.recargo, '0.00'),
    surcharge_percent: asString(row.surcharge_percent) || null,
    surcharge_mode: asMode(row.surcharge_mode ?? row.surcharge_type),
    total: asString(row.total, '0.00'),
    installment_amount: asString(row.installment_amount ?? row.cuota, '0.00'),
    installment_count: count,
    frequency: asFrequency(row.frequency ?? row.frecuencia),
    first_due_date: asString(row.first_due_date),
    last_due_date: asString(row.last_due_date) || plan.at(-1)?.due_date || '',
    anchor_date: asString(row.anchor_date) || asString(row.first_due_date),
    anchor_offset: asInt(row.anchor_offset, 0),
    installments: plan,
    warnings: asWarnings(row.warnings),
  }
}

export function normalizeSale(data: unknown): SaleRead {
  const row = (data ?? {}) as Record<string, unknown>
  const sim = normalizeSimulation(row)
  const clientRaw = (row.client ?? {}) as Record<string, unknown>
  return {
    id: asString(row.id),
    sale_number: asInt(row.sale_number ?? row.number, 0),
    client: {
      id: asString(clientRaw.id),
      name: asString(clientRaw.name),
    },
    item_description: asString(row.item_description ?? row.article),
    price: asString(row.price, '0.00'),
    down_payment: asString(row.down_payment, '0.00'),
    financed_balance: sim.financed_balance,
    surcharge: sim.surcharge,
    surcharge_percent: sim.surcharge_percent,
    surcharge_mode: sim.surcharge_mode,
    total: sim.total,
    installment_amount: sim.installment_amount,
    installment_count: sim.installment_count,
    frequency: sim.frequency,
    first_due_date: sim.first_due_date,
    last_due_date: sim.last_due_date,
    status: asString(row.status, 'activa'),
    voided_at: asString(row.voided_at) || null,
    voided_reason: asString(row.voided_reason) || null,
    voided_by: asString(row.voided_by ?? row.voided_by_membership_id) || null,
    installments: sim.installments,
    warnings: sim.warnings,
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
): Promise<SaleRead> {
  // Send Idempotency-Key only. Do not read Idempotent-Replayed: CORS has no
  // expose_headers yet (CBF-212). Success is the JSON body / status.
  const { data } = await api.post<unknown>('/sales', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
  return normalizeSale(data)
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
