import type {
  Frequency,
  InstallmentPreview,
  SaleDetail,
  SimulateSaleResponse,
} from '@/features/sales/services/types'
import {
  lastDayOfMonth,
  parseIsoDate,
  todayParts,
  toIsoDate,
  type DateParts,
} from '@/features/sales/lib/calendar'

function centsFromAmount(raw: string): bigint {
  const [whole = '0', frac = ''] = raw.replace(/,/g, '').split('.')
  let pesos = 0n
  for (const ch of whole) {
    if (ch < '0' || ch > '9') continue
    pesos = pesos * 10n + BigInt(ch)
  }
  const padded = `${frac}00`.slice(0, 2)
  let cents = 0n
  for (const ch of padded) {
    cents = cents * 10n + BigInt(ch)
  }
  return pesos * 100n + cents
}

function amountFromCents(cents: bigint): string {
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  const pesos = abs / 100n
  const rem = abs % 100n
  const frac = rem < 10n ? `0${rem}` : `${rem}`
  return `${negative ? '-' : ''}${pesos}.${frac}`
}

/** Half-up integer division for non-negative cent amounts. */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) return 0n
  if (numerator >= 0n) return (numerator + denominator / 2n) / denominator
  return -((-numerator + denominator / 2n) / denominator)
}

function addDays(parts: DateParts, days: number): DateParts {
  let year = parts.year
  let month = parts.month
  let day = parts.day + days
  while (day > lastDayOfMonth(year, month)) {
    day -= lastDayOfMonth(year, month)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  while (day < 1) {
    month -= 1
    if (month < 1) {
      month = 12
      year -= 1
    }
    day += lastDayOfMonth(year, month)
  }
  return { year, month, day }
}

function addMonthsKeepAnchor(anchorDay: number, start: DateParts, index: number): DateParts {
  let year = start.year
  let month = start.month + index
  while (month > 12) {
    month -= 12
    year += 1
  }
  const last = lastDayOfMonth(year, month)
  return { year, month, day: anchorDay > last ? last : anchorDay }
}

function nextQuincenal(from: DateParts, index: number): DateParts {
  let current = from
  for (let step = 0; step < index; step += 1) {
    if (current.day <= 15) {
      current = { year: current.year, month: current.month, day: lastDayOfMonth(current.year, current.month) }
    } else {
      let month = current.month + 1
      let year = current.year
      if (month > 12) {
        month = 1
        year += 1
      }
      current = { year, month, day: 15 }
    }
  }
  return current
}

export function buildPlan(input: {
  price: string
  down: string
  n: number
  frequency: Frequency
  firstDue?: string
  percent: string
}): {
  financed: string
  surcharge: string
  total: string
  installment: string
  first: string
  last: string
  rows: InstallmentPreview[]
} {
  const price = centsFromAmount(input.price)
  const down = centsFromAmount(input.down)
  const financed = price - down
  const pct = centsFromAmount(input.percent)
  const surcharge = divideRounded(financed * pct, 10000n)
  const total = financed + surcharge
  const n = input.n < 1 ? 1 : input.n
  const count = BigInt(n)
  const base = total / count
  const rem = total - base * count
  const amounts = Array.from({ length: n }, (_, index) =>
    index === n - 1 ? base + rem : base,
  )
  const today = todayParts()
  const first = input.firstDue
    ? (parseIsoDate(input.firstDue) ?? today)
    : input.frequency === 'semanal'
      ? addDays(today, 7)
      : input.frequency === 'quincenal'
        ? today.day <= 15
          ? { year: today.year, month: today.month, day: 15 }
          : { year: today.year, month: today.month, day: lastDayOfMonth(today.year, today.month) }
        : addMonthsKeepAnchor(today.day, today, 1)
  const rows = amounts.map((cents, index) => {
    const due =
      input.frequency === 'semanal'
        ? addDays(first, index * 7)
        : input.frequency === 'quincenal'
          ? nextQuincenal(first, index)
          : addMonthsKeepAnchor(first.day, first, index)
    return {
      number: index + 1,
      due_date: toIsoDate(due),
      amount: amountFromCents(cents),
    }
  })
  return {
    financed: amountFromCents(financed),
    surcharge: amountFromCents(surcharge),
    total: amountFromCents(total),
    installment: amountFromCents(amounts[0] ?? 0n),
    first: rows[0]?.due_date ?? toIsoDate(first),
    last: rows.at(-1)?.due_date ?? toIsoDate(first),
    rows,
  }
}

export function simulateResponse(
  plan: ReturnType<typeof buildPlan>,
  extras: Partial<SimulateSaleResponse> = {},
): SimulateSaleResponse {
  return {
    financed: plan.financed,
    surcharge: plan.surcharge,
    total: plan.total,
    installment_amount: plan.installment,
    installments: plan.rows,
    settings_configured: true,
    anchor_date: plan.first,
    anchor_offset: 0,
    warnings: [],
    ...extras,
  }
}

export function saleDetailFromPlan(
  plan: ReturnType<typeof buildPlan>,
  input: {
    id: string
    sale_number: number
    client_id: string
    client_name: string
    item_description: string
    price: string
    down_payment: string
    frequency: Frequency
    anchor_date?: string
    anchor_offset?: number
    seller_membership_id?: string
    warnings?: SaleDetail['warnings']
  },
): SaleDetail {
  return {
    id: input.id,
    sale_number: input.sale_number,
    client_id: input.client_id,
    client: { id: input.client_id, name: input.client_name },
    seller_membership_id: input.seller_membership_id ?? 'mem-user-cashier-biz-norte',
    item_description: input.item_description,
    price: input.price,
    down_payment: input.down_payment,
    financed: plan.financed,
    surcharge: plan.surcharge,
    total: plan.total,
    surcharge_kind: 'percent_of_financed',
    surcharge_percent: '20.00',
    surcharge_amount: null,
    interest_method: 'recargo_fijo',
    frequency: input.frequency,
    installments_count: plan.rows.length,
    anchor_date: input.anchor_date ?? plan.first,
    anchor_offset: input.anchor_offset ?? 0,
    first_due_date: plan.first,
    status: 'activa',
    voided_at: null,
    void_reason: null,
    voided_by: null,
    created_at: '2026-10-18T00:00:00.000Z',
    installments: plan.rows.map((row) => ({
      ...row,
      paid: '0.00',
      late_fee: '0.00',
      status: 'pendiente',
    })),
    contract: {},
    warnings: input.warnings ?? [],
  }
}
