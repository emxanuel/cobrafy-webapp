import { describe, expect, it } from 'vitest'

import { saleDotStatuses } from './dot-status'

const CASES: Array<{
  name: string
  status: string
  has_payment?: boolean
  expected: string
}> = [
  { name: 'overdue→late', status: 'overdue', expected: 'late' },
  {
    name: 'overdue+has_payment→late-partial',
    status: 'overdue',
    has_payment: true,
    expected: 'late-partial',
  },
  { name: 'partial→partial', status: 'partial', expected: 'partial' },
  {
    name: 'partial+pago→partial',
    status: 'partial',
    has_payment: true,
    expected: 'partial',
  },
  { name: 'pending→pending', status: 'pending', expected: 'pending' },
  {
    name: 'pending+pago→pending-paid',
    status: 'pending',
    has_payment: true,
    expected: 'pending-paid',
  },
  { name: 'paid→paid', status: 'paid', expected: 'paid' },
  { name: 'cancelled→cancelled', status: 'cancelled', expected: 'cancelled' },
]

describe('saleDotStatuses', () => {
  it.each(CASES)('$name', ({ status, has_payment, expected }) => {
    expect(
      saleDotStatuses({
        status: 'activa',
        installments_count: 1,
        installments: [{ status, has_payment }],
      }),
    ).toEqual([expected])
  })

  it('venta anulada → todos cancelled', () => {
    expect(
      saleDotStatuses({
        status: 'anulada',
        installments_count: 4,
        installments: [
          { status: 'paid' },
          { status: 'overdue', has_payment: true },
          { status: 'pending' },
          { status: 'partial' },
        ],
      }),
    ).toEqual(['cancelled', 'cancelled', 'cancelled', 'cancelled'])
  })

  it('menos filas que installments_count → se rellena con pending', () => {
    expect(
      saleDotStatuses({
        status: 'activa',
        installments_count: 5,
        installments: [{ status: 'paid' }, { status: 'overdue' }],
      }),
    ).toEqual(['paid', 'late', 'pending', 'pending', 'pending'])
  })

  it('cuota cancelada en venta activa → cancelled', () => {
    expect(
      saleDotStatuses({
        status: 'activa',
        installments_count: 3,
        installments: [{ status: 'paid' }, { status: 'cancelled' }, { status: 'pending' }],
      }),
    ).toEqual(['paid', 'cancelled', 'pending'])
  })
})
