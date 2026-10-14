import { beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { getFieldErrors, isApiError } from '@/features/shared/lib/api-error'
import { users } from '@/test/fixtures'
import { createClient } from './requests'

describe('createClient errors', () => {
  beforeEach(() => {
    useSessionStore.getState().setSession({
      accessToken: 'token-cashier',
      user: users.cashier,
      memberships: [],
      pinConfigured: false,
      locked: false,
    })
    useBusinessStore.getState().setActiveBusinessId('biz-norte')
  })

  it('expone el 422 en document_number', async () => {
    try {
      await createClient({
        first_name: 'Ana',
        last_name: 'Pérez',
        document_type: 'cedula',
        document_number: 'malo',
        phone: '8095551111',
        references: [],
        guarantors: [],
      })
      throw new Error('debía fallar')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(getFieldErrors(error).document_number).toBe(
        'El formato de la cédula no es válido.',
      )
    }
  })
})
