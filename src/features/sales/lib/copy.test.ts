import { describe, expect, it } from 'vitest'

import { GENERIC_SALE_ERROR, saleErrorBanner, surchargeLabel } from './copy'

describe('saleErrorBanner', () => {
  it('un código desconocido usa el mensaje genérico', () => {
    const copy = saleErrorBanner('SOME_NEW_CODE', 'dueño', 'cli-1', 'debug interno')
    expect(copy.title).toBe(GENERIC_SALE_ERROR)
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
