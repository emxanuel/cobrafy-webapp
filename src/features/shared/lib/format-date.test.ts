import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime } from './format-date'

describe('formatDateTime', () => {
  it('rellena dd/mm/aaaa y usa a. m. / p. m. en America/Santo_Domingo', () => {
    expect(formatDateTime('2026-10-17T14:42:00.000Z')).toBe('17/10/2026 10:42 a. m.')
    expect(formatDateTime('2026-10-17T19:15:00.000Z')).toBe('17/10/2026 3:15 p. m.')
  })

  it('medianoche y mediodía quedan en 12:00', () => {
    expect(formatDateTime('2026-10-17T04:00:00.000Z')).toBe('17/10/2026 12:00 a. m.')
    expect(formatDateTime('2026-10-17T16:00:00.000Z')).toBe('17/10/2026 12:00 p. m.')
  })

  it('convierte un timestamp UTC al huso de Santo Domingo', () => {
    expect(formatDateTime('2026-01-15T04:05:00.000Z')).toBe('15/01/2026 12:05 a. m.')
  })
})

describe('formatDate', () => {
  it('formatea solo la fecha con dd/mm/aaaa', () => {
    expect(formatDate('2026-10-17T16:00:00.000Z')).toBe('17/10/2026')
    expect(formatDate('2026-09-29T16:00:00.000Z')).toBe('29/09/2026')
  })
})
