import { describe, expect, it } from 'vitest'

import { isSaleVoided, purchaseCounterLabel } from './sale-status'

describe('sale status', () => {
  it('cuenta activas y anuladas por status, no por montos', () => {
    expect(
      purchaseCounterLabel([
        { status: 'activa' },
        { status: 'activa' },
        { status: 'anulada' },
      ]),
    ).toBe('2 activas · 1 anulada')
    expect(purchaseCounterLabel([{ status: 'activa' }])).toBe('1 activa · 0 anuladas')
    expect(purchaseCounterLabel([{ status: 'voided' }])).toBe('0 activas · 1 anulada')
  })

  it('trata anulada y voided como anulada', () => {
    expect(isSaleVoided('anulada')).toBe(true)
    expect(isSaleVoided('voided')).toBe(true)
    expect(isSaleVoided('activa')).toBe(false)
  })
})
