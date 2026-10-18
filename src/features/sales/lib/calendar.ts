export const BUSINESS_ZONE = 'America/Santo_Domingo'

export type DateParts = {
  year: number
  month: number
  day: number
}

function digitValue(value: string): number {
  let n = 0
  for (const ch of value) {
    if (ch < '0' || ch > '9') continue
    n = n * 10 + (ch.charCodeAt(0) - 48)
  }
  return n
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

export function todayParts(now = new Date(), timeZone = BUSINESS_ZONE): DateParts {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [year, month, day] = formatted.split('-')
  return { year: digitValue(year ?? ''), month: digitValue(month ?? ''), day: digitValue(day ?? '') }
}

export function toIsoDate(parts: DateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

export function parseIsoDate(iso: string): DateParts | null {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return null
  return { year: digitValue(year), month: digitValue(month), day: digitValue(day) }
}

function isLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

export function lastDayOfMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30
  return 31
}

export function compareParts(a: DateParts, b: DateParts): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

export function addCalendarYears(parts: DateParts, years: number): DateParts {
  const year = parts.year + years
  const last = lastDayOfMonth(year, parts.month)
  return { year, month: parts.month, day: parts.day > last ? last : parts.day }
}

export type QuincenalOption = {
  iso: string
  kind: 'day15' | 'month_end'
}

export function quincenalOptions(
  from = todayParts(),
  until = addCalendarYears(from, 1),
): QuincenalOption[] {
  const options: QuincenalOption[] = []
  let year = from.year
  let month = from.month
  while (compareParts({ year, month, day: 1 }, { year: until.year, month: until.month, day: 1 }) <= 0) {
    const mid: DateParts = { year, month, day: 15 }
    const end: DateParts = { year, month, day: lastDayOfMonth(year, month) }
    if (compareParts(mid, from) >= 0 && compareParts(mid, until) <= 0) {
      options.push({ iso: toIsoDate(mid), kind: 'day15' })
    }
    if (compareParts(end, from) >= 0 && compareParts(end, until) <= 0) {
      options.push({ iso: toIsoDate(end), kind: 'month_end' })
    }
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return options
}
