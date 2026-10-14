const DO_LOCALE = 'es-DO'
const DO_ZONE = 'America/Santo_Domingo'

export function formatDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(DO_LOCALE, { timeZone: DO_ZONE })
}
