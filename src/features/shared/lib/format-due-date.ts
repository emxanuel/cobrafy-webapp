/**
 * Formats a calendar date `YYYY-MM-DD` as `dd/mm/aaaa`.
 * Splits the string by hand — never `new Date('YYYY-MM-DD')`, which shifts
 * a day back in America/Santo_Domingo.
 */
export function formatDueDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}
