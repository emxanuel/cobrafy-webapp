import { describe, expect, it } from 'vitest'

import { dotsAriaLabel, isSaleSettled, summaryLineParts } from './installment-summary'

const mixed = { paid: 3, partial: 1, overdue: 2, pending: 6, cancelled: 0 }

describe('installment-summary', () => {
  it('el aria-label sale de installments_summary aunque los puntos digan otra cosa', () => {
    expect(
      dotsAriaLabel({
        count: 12,
        summary: { paid: 3, partial: 1, overdue: 0, pending: 8, cancelled: 0 },
        statuses: Array.from({ length: 12 }, () => 'pending'),
      }),
    ).toBe('12 cuotas: 3 pagadas, 1 parcial, 8 pendientes')
  })

  it('usa vencida, no atrasada, y omite ceros', () => {
    expect(dotsAriaLabel({ count: 12, summary: mixed })).toBe(
      '12 cuotas: 3 pagadas, 1 parcial, 2 vencidas, 6 pendientes',
    )
    expect(
      summaryLineParts(mixed).map((part) => part.label),
    ).toEqual(['3 pagadas', '1 parcial', '2 vencidas', '6 pendientes'])
    expect(summaryLineParts(mixed).find((part) => part.key === 'overdue')?.className).toContain(
      'text-danger',
    )
  })

  it('singular y plural', () => {
    expect(
      summaryLineParts({ paid: 1, partial: 1, overdue: 1, pending: 1, cancelled: 0 }).map(
        (part) => part.label,
      ),
    ).toEqual(['1 pagada', '1 parcial', '1 vencida', '1 pendiente'])
  })

  it('todas pagadas es Saldada', () => {
    expect(
      isSaleSettled({
        installments_count: 24,
        installments_summary: { paid: 24, partial: 0, overdue: 0, pending: 0, cancelled: 0 },
      }),
    ).toBe(true)
  })

  it('todas canceladas: N cuotas canceladas', () => {
    expect(
      dotsAriaLabel({
        count: 4,
        summary: { paid: 0, partial: 0, overdue: 0, pending: 0, cancelled: 4 },
      }),
    ).toBe('4 cuotas canceladas')
  })
})
