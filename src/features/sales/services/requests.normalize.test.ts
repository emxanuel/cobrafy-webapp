import { describe, expect, it } from 'vitest'

import { normalizeSaleDetail, normalizeSimulation } from './requests'

describe('normalizeSimulation / normalizeSaleDetail vs fa39236', () => {
  it('lee financed, no financed_balance, y no inventa first_due_date', () => {
    const plan = normalizeSimulation({
      financed: '10000.00',
      surcharge: '0.00',
      total: '10000.00',
      installment_amount: '3333.33',
      installments: [
        { number: 1, due_date: '2026-11-17', amount: '3333.33' },
        { number: 2, due_date: '2026-12-17', amount: '3333.33' },
        { number: 3, due_date: '2027-01-17', amount: '3333.34' },
      ],
      settings_configured: true,
      anchor_date: '2026-11-17',
      anchor_offset: 0,
      warnings: [],
    })
    expect(plan.financed).toBe('10000.00')
    expect(plan).not.toHaveProperty('financed_balance')
    expect(plan).not.toHaveProperty('first_due_date')
    expect(plan).not.toHaveProperty('installment_count')
    expect(plan.installments).toHaveLength(3)
  })

  it('SaleDetail usa installments_count, void_reason y voided_by objeto', () => {
    const sale = normalizeSaleDetail({
      id: 'sale-1',
      sale_number: 1,
      client_id: 'cli-1',
      client: { id: 'cli-1', name: 'Ana Pérez' },
      seller_membership_id: 'mem-1',
      item_description: 'Radio',
      price: '999.99',
      down_payment: '0.00',
      financed: '999.99',
      surcharge: '0.00',
      total: '999.99',
      balance: '999.99',
      surcharge_kind: 'percent_of_financed',
      surcharge_percent: '0.00',
      surcharge_amount: null,
      interest_method: 'recargo_fijo',
      frequency: 'mensual',
      installments_count: 1,
      anchor_date: '2026-11-17',
      anchor_offset: 0,
      first_due_date: '2026-11-17',
      status: 'activa',
      voided_at: null,
      void_reason: null,
      voided_by: { membership_id: 'mem-owner', name: 'Olivia Dueña' },
      created_at: '2026-10-18T00:00:00.000Z',
      installments: [
        {
          number: 1,
          due_date: '2026-11-17',
          amount: '999.99',
          paid: '0.00',
          late_fee: '0.00',
          status: 'pendiente',
        },
      ],
      contract: {},
      warnings: [],
    })
    expect(sale.financed).toBe('999.99')
    expect(sale.balance).toBe('999.99')
    expect(sale.installments_count).toBe(1)
    expect(sale.void_reason).toBeNull()
    expect(sale.voided_by).toEqual({ membership_id: 'mem-owner', name: 'Olivia Dueña' })
    expect(sale.installments[0]?.paid).toBe('0.00')
    expect(sale).not.toHaveProperty('financed_balance')
    expect(sale).not.toHaveProperty('voided_reason')
  })

  it('SaleRead.balance es string y cae a 0.00 si falta', () => {
    const sale = normalizeSaleDetail({
      id: 'sale-2',
      sale_number: 2,
      client_id: 'cli-1',
      client: { id: 'cli-1', name: 'Ana Pérez' },
      item_description: 'Radio',
      total: '100.00',
      status: 'activa',
    })
    expect(sale.balance).toBe('0.00')
    expect(typeof sale.balance).toBe('string')
    expect(sale.total).toBe('100.00')
  })
})
