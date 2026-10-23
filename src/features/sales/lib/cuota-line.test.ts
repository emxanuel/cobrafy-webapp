import { describe, expect, it } from 'vitest'

import { saleCuotaLine } from './cuota-line'

describe('saleCuotaLine', () => {
  it('sin montos nuevos deja n frecuencia, como hoy', () => {
    expect(
      saleCuotaLine({ installments_count: 12, frequency: 'mensual' }),
    ).toBe('12 mensuales')
  })

  it('normal usa regular_installment_amount', () => {
    expect(
      saleCuotaLine({
        installments_count: 12,
        frequency: 'mensual',
        regular_installment_amount: '1500.00',
        last_installment_amount: '1500.00',
      }),
    ).toBe('12 mensuales × RD$ 1,500.00')
  })

  it('si la última es distinta agrega última', () => {
    expect(
      saleCuotaLine({
        installments_count: 9,
        frequency: 'quincenal',
        regular_installment_amount: '1225.00',
        last_installment_amount: '1228.00',
      }),
    ).toBe('9 quincenales × RD$ 1,225.00 · última RD$ 1,228.00')
  })

  it('con una sola cuota solo muestra el monto', () => {
    expect(
      saleCuotaLine({
        installments_count: 1,
        frequency: 'mensual',
        regular_installment_amount: '1800.00',
        last_installment_amount: '1800.00',
      }),
    ).toBe('RD$ 1,800.00')
  })

  it('en una venta anulada mantiene la misma línea', () => {
    expect(
      saleCuotaLine({
        installments_count: 4,
        frequency: 'semanal',
        regular_installment_amount: '900.00',
        last_installment_amount: '900.00',
      }),
    ).toBe('4 semanales × RD$ 900.00')
  })
})
