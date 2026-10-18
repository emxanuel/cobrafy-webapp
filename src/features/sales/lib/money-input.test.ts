import { describe, expect, it } from 'vitest'

import { formatAmountInput, isPositiveAmount, parseMoneyInput } from './money-input'

describe('parseMoneyInput', () => {
  it('acepta 18500, 18,500 y 18500.5 como string', () => {
    expect(parseMoneyInput('18500')).toBe('18500.00')
    expect(parseMoneyInput('18,500')).toBe('18500.00')
    expect(parseMoneyInput('18500.5')).toBe('18500.50')
    expect(parseMoneyInput('999.99')).toBe('999.99')
  })

  it('isPositiveAmount no usa Number', () => {
    expect(isPositiveAmount('0.00')).toBe(false)
    expect(isPositiveAmount('0.01')).toBe(true)
    expect(isPositiveAmount('999.99')).toBe(true)
  })

  it('formatea el input con miles', () => {
    expect(formatAmountInput('18500.00')).toBe('18,500.00')
  })
})
