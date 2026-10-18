const DO_ZONE = 'America/Santo_Domingo'

function pad2(value: string): string {
  if (value.length >= 2) return value.slice(-2)
  return value.length === 1 ? `0${value}` : '00'
}

function periodLabel(raw: string): string {
  const compact = raw.replace(/\./g, '').replace(/\s/g, '').toLowerCase()
  return compact.startsWith('p') ? 'p. m.' : 'a. m.'
}

function hour12(raw: string): string {
  const digits = raw.replace(/\D/g, '') || '12'
  const trimmed = digits.replace(/^0+(?=\d)/, '') || '12'
  return trimmed === '0' ? '12' : trimmed
}

function partsInZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: DO_ZONE,
    ...options,
  }).formatToParts(date)
  const map: Record<string, string> = {}
  for (const part of formatted) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return map
}

export function formatDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = partsInZone(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const day = pad2(parts.day ?? '')
  const month = pad2(parts.month ?? '')
  const year = parts.year ?? ''
  const hour = hour12(parts.hour ?? '12')
  const minute = pad2(parts.minute ?? '00')
  const period = periodLabel(parts.dayPeriod ?? 'AM')
  return `${day}/${month}/${year} ${hour}:${minute} ${period}`
}

export function formatDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = partsInZone(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return `${pad2(parts.day ?? '')}/${pad2(parts.month ?? '')}/${parts.year ?? ''}`
}
