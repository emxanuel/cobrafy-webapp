import type { Frequency, PlanInstallment } from '@/features/sales/services/types'
import {
  lastDayOfMonth,
  parseIsoDate,
  todayParts,
  toIsoDate,
  type DateParts,
} from '@/features/sales/lib/calendar'

function centsFromAmount(raw: string): number {
  const [whole = '0', frac = ''] = raw.replace(/,/g, '').split('.')
  let pesos = 0
  for (const ch of whole) {
    if (ch < '0' || ch > '9') continue
    pesos = pesos * 10 + (ch.charCodeAt(0) - 48)
  }
  const padded = `${frac}00`.slice(0, 2)
  let cents = 0
  for (const ch of padded) {
    cents = cents * 10 + (ch.charCodeAt(0) - 48)
  }
  return pesos * 100 + cents
}

function amountFromCents(cents: number): string {
  const negative = cents < 0
  const abs = negative ? -cents : cents
  const pesos = Math.trunc(abs / 100)
  const rem = abs - pesos * 100
  const frac = rem < 10 ? `0${rem}` : String(rem)
  return `${negative ? '-' : ''}${pesos}.${frac}`
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
  rows: PlanInstallment[]
} {
  const price = centsFromAmount(input.price)
  const down = centsFromAmount(input.down)
  const financed = price - down
  const pct = centsFromAmount(input.percent)
  const surcharge = Math.round((financed * pct) / 10000)
  const total = financed + surcharge
  const n = input.n < 1 ? 1 : input.n
  const base = Math.trunc(total / n)
  const rem = total - base * n
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
    installment: amountFromCents(amounts[0] ?? 0),
    first: rows[0]?.due_date ?? toIsoDate(first),
    last: rows.at(-1)?.due_date ?? toIsoDate(first),
    rows,
  }
}
