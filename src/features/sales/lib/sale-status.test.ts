import { describe, expect, it } from 'vitest'

import { canShowVoid, isSaleVoided, isUnpaidAmount, purchaseCounterLabel } from './sale-status'

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
    expect(isSaleVoided('active')).toBe(false)
  })
})

describe('canShowVoid', () => {
  const unpaid = [{ paid: '0.00' }, { paid: '0.00' }]

  it('solo el dueño ve Anular en una venta activa sin pagos', () => {
    expect(canShowVoid('dueño', { status: 'active', installments: unpaid })).toBe(true)
    expect(canShowVoid('dueño', { status: 'activa', installments: unpaid })).toBe(true)
    expect(canShowVoid('cajero', { status: 'active', installments: unpaid })).toBe(false)
    expect(canShowVoid('cobrador', { status: 'active', installments: unpaid })).toBe(false)
  })

  it('oculta Anular si hay pagos, comparando el string normalizado', () => {
    expect(canShowVoid('dueño', { status: 'active', installments: [{ paid: '0.01' }] })).toBe(
      false,
    )
    expect(
      canShowVoid('dueño', { status: 'active', installments: [{ paid: '0.00' }, { paid: '1.00' }] }),
    ).toBe(false)
    expect(canShowVoid('dueño', { status: 'active', installments: [{ paid: '0' }] })).toBe(true)
    expect(canShowVoid('dueño', { status: 'active', installments: [{ paid: '0.0' }] })).toBe(true)
    expect(isUnpaidAmount('0.00')).toBe(true)
    expect(isUnpaidAmount('0')).toBe(true)
    expect(isUnpaidAmount('1.00')).toBe(false)
  })

  it('oculta Anular si la venta ya está anulada', () => {
    expect(canShowVoid('dueño', { status: 'voided', installments: unpaid })).toBe(false)
    expect(canShowVoid('dueño', { status: 'anulada', installments: unpaid })).toBe(false)
  })
})
