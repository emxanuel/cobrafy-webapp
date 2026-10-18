import { describe, expect, it } from 'vitest'

import { toApiError } from '@/features/shared/lib/api-error'
import { AxiosError } from 'axios'

import {
  CLIENT_BLOCKED_WARNING,
  COLLECTOR_INACTIVE_WARNING,
  LEGAL_DATA_MISSING_WARNING,
  SALE_CONFLICTS,
} from './backend-conflicts'

function axiosError(status: number, data: unknown) {
  return new AxiosError('conflict', 'ERR', undefined, undefined, {
    status,
    statusText: 'Conflict',
    headers: {},
    config: { headers: {} } as never,
    data,
  })
}

describe('contratos 409 de cobrafy-backend fa39236', () => {
  it('cada code va con field null y el mensaje exacto', () => {
    for (const item of SALE_CONFLICTS) {
      expect(item.field).toBeNull()
      const error = toApiError(
        axiosError(409, {
          detail: [{ field: item.field, code: item.code, message: item.message }],
        }),
      )
      expect(error.code).toBe(item.code)
      expect(error.fieldErrors).toEqual({})
      if (
        item.code === 'DOCUMENT_UNREADABLE' ||
        item.code === 'DOCUMENT_UNREADABLE_GUARANTOR' ||
        item.code === 'LEGACY_SALE_LEGAL_DATA_MISSING' ||
        item.code === 'SALE_ALREADY_VOIDED' ||
        item.code === 'SALE_HAS_PAYMENTS'
      ) {
        expect(error.message.length).toBeGreaterThan(0)
      } else {
        expect(error.message).toBe(item.message)
      }
    }
  })

  it('los warnings del simulador usan snake_case y el copy del backend', () => {
    expect(COLLECTOR_INACTIVE_WARNING.code).toBe('collector_inactive')
    expect(CLIENT_BLOCKED_WARNING.code).toBe('client_blocked')
    expect(LEGAL_DATA_MISSING_WARNING.code).toBe('legal_data_missing')
    expect(COLLECTOR_INACTIVE_WARNING.message).toMatch(/cobrador asignado/)
    expect(LEGAL_DATA_MISSING_WARNING.message).toBe(
      'Completa el RNC y la dirección del negocio antes de vender',
    )
  })
})
