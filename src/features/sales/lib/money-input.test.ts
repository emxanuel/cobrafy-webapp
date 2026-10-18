import { describe, expect, it } from 'vitest'

import { formatAmountInput, isPositiveAmount, parseMoneyInput } from './money-input'

describe('parseMoneyInput', () => {
  it('acepta 1,850.50, 1850 y 0.99 como string', () => {
    expect(parseMoneyInput('1,850.50')).toBe('1850.50')
    expect(parseMoneyInput('1850')).toBe('1850.00')
    expect(parseMoneyInput('0.99')).toBe('0.99')
    expect(parseMoneyInput('18,500')).toBe('18500.00')
    expect(parseMoneyInput('18500.5')).toBe('18500.50')
    expect(parseMoneyInput('999.99')).toBe('999.99')
  })

  it('rechaza 1850O, 18500.999, comas mal puestas y montos sobre el máximo', () => {
    expect(parseMoneyInput('1850O')).toBeNull()
    expect(parseMoneyInput('18500.999')).toBeNull()
    expect(parseMoneyInput('1,5')).toBeNull()
    expect(parseMoneyInput('1500,50')).toBeNull()
    expect(parseMoneyInput('9,999,999,999,999,999.99')).toBe('9999999999999999.99')
    expect(parseMoneyInput('10000000000000000')).toBeNull()
    expect(parseMoneyInput('10,000,000,000,000,000.00')).toBeNull()
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
