import { describe, expect, it } from 'vitest'

import { buildSaleCreateBody, hasXorDueAnchor } from './sale-payload'

describe('buildSaleCreateBody', () => {
  it('manda anchor_date+anchor_offset y no first_due_date', () => {
    const body = buildSaleCreateBody(
      {
        client_id: 'cli-1',
        item_description: 'Nevera',
        price: '999.99',
        down_payment: '0.00',
        installments: 3,
        frequency: 'mensual',
        first_due_date: '2026-11-17',
      },
      { anchor_date: '2026-11-17', anchor_offset: 0 },
    )
    expect(body.price).toBe('999.99')
    expect(typeof body.price).toBe('string')
    expect(body.first_due_date).toBeUndefined()
    expect(body.anchor_date).toBe('2026-11-17')
    expect(body.anchor_offset).toBe(0)
    expect(hasXorDueAnchor(body)).toBe(true)
    expect(hasXorDueAnchor({ ...body, first_due_date: '2026-11-17' })).toBe(false)
  })
})
