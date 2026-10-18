import { describe, expect, it } from 'vitest'

import {
  auditActionTitle,
  ENTITY_BADGE,
  ENTITY_OPTIONS,
  fieldLabel,
  formatAuditValue,
} from './labels'
import type { AuditRead } from '@/features/audit/services/types'

function event(overrides: Partial<AuditRead>): AuditRead {
  return {
    id: 'aud-x',
    business_id: 'biz-norte',
    user_id: 'user-1',
    membership_id: 'mem-1',
    action: 'update',
    entity: 'client',
    entity_id: 'cli-1',
    before: null,
    after: null,
    ip: null,
    user_agent: null,
    created_at: '2026-10-14T12:00:00.000Z',
    ...overrides,
  }
}

describe('auditActionTitle', () => {
  it('traduce login y select_business', () => {
    expect(auditActionTitle(event({ action: 'login', entity: 'user' }))).toBe('Inicio de sesión')
    expect(auditActionTitle(event({ action: 'select_business', entity: 'business' }))).toBe(
      'Cambio de negocio',
    )
    expect(auditActionTitle(event({ action: 'login_failed', entity: 'user' }))).toBe(
      'Intento de entrada fallido',
    )
  })

  it('traduce credit_settings y no usa la palabra interés', () => {
    expect(
      auditActionTitle(event({ action: 'create', entity: 'credit_settings' })),
    ).toBe('Configuración de crédito creada')
    expect(
      auditActionTitle(event({ action: 'update', entity: 'credit_settings' })),
    ).toBe('Configuración de crédito editada')
    expect(ENTITY_BADGE.credit_settings).toBe('Crédito')
    expect(ENTITY_OPTIONS.some((option) => option.value === 'credit_settings')).toBe(true)
    expect(ENTITY_OPTIONS.find((option) => option.value === 'credit_settings')?.label).toBe(
      'Crédito',
    )
    expect(fieldLabel('interest_method')).toBe('Método de cálculo')
    expect(fieldLabel('surcharge_kind')).toBe('Tipo de recargo')
    expect(fieldLabel('surcharge_percent')).toBe('Recargo (%)')
    expect(fieldLabel('surcharge_amount')).toBe('Recargo fijo')
    expect(fieldLabel('allowed_frequencies')).toBe('Frecuencias permitidas')
    expect(fieldLabel('max_installments')).toBe('Máximo de cuotas')
    expect(fieldLabel('min_down_payment_percent')).toBe('Inicial mínima (%)')

    const visible = [
      ...ENTITY_OPTIONS.map((option) => option.label),
      ...Object.values(ENTITY_BADGE),
      fieldLabel('interest_method'),
      auditActionTitle(event({ action: 'create', entity: 'credit_settings' })),
      auditActionTitle(event({ action: 'update', entity: 'credit_settings' })),
    ].join(' ')
    expect(visible.toLowerCase()).not.toMatch(/inter[eé]s/)
  })

  it('mapea los enums de crédito y deja el valor crudo si no lo conoce', () => {
    const names = new Map<string, string>()
    expect(formatAuditValue('interest_method', 'recargo_fijo', names)).toBe('Recargo fijo')
    expect(formatAuditValue('surcharge_kind', 'percent_of_financed', names)).toBe('Porcentaje')
    expect(formatAuditValue('surcharge_kind', 'fixed_amount', names)).toBe('Monto fijo')
    expect(formatAuditValue('allowed_frequencies', ['semanal', 'quincenal', 'mensual'], names)).toBe(
      'Semanal, Quincenal, Mensual',
    )
    expect(formatAuditValue('interest_method', 'otro_metodo', names)).toBe('otro_metodo')
    expect(formatAuditValue('surcharge_kind', 'desconocido', names)).toBe('desconocido')
  })
})
