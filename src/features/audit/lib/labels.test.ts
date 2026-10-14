import { describe, expect, it } from 'vitest'

import { auditActionTitle } from './labels'
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
})
