import { describe, expect, it } from 'vitest'

import { formatMoney } from './format-money'

describe('formatMoney', () => {
  it('formatea el string sin convertirlo a número', () => {
    expect(formatMoney('1500.00')).toBe('RD$ 1,500.00')
    expect(formatMoney('1607.14')).toBe('RD$ 1,607.14')
    expect(formatMoney('1607.16')).toBe('RD$ 1,607.16')
    expect(formatMoney('3333.33')).toBe('RD$ 3,333.33')
    expect(formatMoney('3333.34')).toBe('RD$ 3,333.34')
    expect(formatMoney('999.99')).toBe('RD$ 999.99')
    expect(formatMoney('0.00')).toBe('RD$ 0.00')
    expect(formatMoney('18500.00')).toBe('RD$ 18,500.00')
  })
})
