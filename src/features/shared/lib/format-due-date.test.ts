import { describe, expect, it } from 'vitest'

import { formatDueDate } from './format-due-date'

describe('formatDueDate', () => {
  it('parte YYYY-MM-DD a mano y no se corre un día', () => {
    expect(formatDueDate('2026-11-17')).toBe('17/11/2026')
    expect(formatDueDate('2026-02-28')).toBe('28/02/2026')
    expect(formatDueDate('2026-03-31')).toBe('31/03/2026')
    expect(formatDueDate('2026-04-30')).toBe('30/04/2026')
    // new Date('2026-11-17') is midnight UTC = 16/11 in America/Santo_Domingo.
    expect(formatDueDate.toString()).not.toMatch(/new Date/)
  })

  it('sigue en el 17 bajo America/Santo_Domingo y UTC', () => {
    expect(formatDueDate('2026-11-17')).toBe('17/11/2026')
    const utcParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date('2026-11-17T00:00:00.000Z'))
    expect(utcParts).toBe('2026-11-17')
    expect(formatDueDate(utcParts)).toBe('17/11/2026')
  })
})
