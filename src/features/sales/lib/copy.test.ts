import { describe, expect, it } from 'vitest'

import { GENERIC_SALE_ERROR, saleErrorBanner, saleErrorHasOwnCopy, surchargeLabel } from './copy'

describe('saleErrorBanner', () => {
  it('un código desconocido muestra el message del backend tal cual', () => {
    const copy = saleErrorBanner('SOME_NEW_CODE', 'dueño', 'cli-1', 'debug interno')
    expect(copy.title).toBe('debug interno')
    expect(copy.body).toBe('')
    expect(copy.tone).toBe('warning')
    expect(copy.title).not.toBe(GENERIC_SALE_ERROR)
  })

  it('saleErrorHasOwnCopy distingue códigos con aviso propio', () => {
    expect(saleErrorHasOwnCopy('CLIENT_BLOCKED')).toBe(true)
    expect(saleErrorHasOwnCopy('SOME_NEW_CODE')).toBe(false)
    expect(saleErrorHasOwnCopy(undefined)).toBe(false)
  })

  it('CREDIT_SETTINGS_MISSING y RNC tienen copy propio', () => {
    expect(saleErrorBanner('CREDIT_SETTINGS_MISSING', 'dueño', 'cli-1').title).toMatch(
      /configurado el crédito/i,
    )
    expect(saleErrorBanner('CREDIT_SETTINGS_INCOMPLETE', 'dueño', 'cli-1').title).toMatch(
      /incompleta/i,
    )
    expect(saleErrorBanner('BUSINESS_LEGAL_DATA_MISSING', 'dueño', 'cli-1').title).toMatch(/RNC/)
    expect(saleErrorBanner('DOCUMENT_UNREADABLE', 'dueño', 'cli-1').title).toMatch(/documento del cliente/)
  })

  it('fixed_amount se etiqueta como recargo fijo', () => {
    expect(surchargeLabel({ surcharge_kind: 'fixed_amount' })).toBe('Recargo (monto fijo)')
    expect(surchargeLabel({ surcharge_kind: 'percent_of_financed', surcharge_percent: '20.00' })).toBe(
      'Recargo (20 %)',
    )
  })
})
