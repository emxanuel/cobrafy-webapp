import { afterEach, describe, expect, it } from 'vitest'

import type { SaleCreateRequest } from '@/features/sales/services/types'
import type { SaleFormSnapshot } from '@/features/sales/lib/sale-payload'

import {
  clearAllPendingSales,
  clearPendingSale,
  pendingSaleStorageKey,
  readPendingSale,
  shouldReleasePendingSale,
  writePendingSale,
} from './pending-sale'

const snapshot: SaleFormSnapshot = {
  client_id: 'cli-1',
  item_description: 'Nevera',
  price: '18500.00',
  down_payment: '0.00',
  installments: 12,
  frequency: 'mensual',
  first_due_date: '2026-11-17',
}

const payload: SaleCreateRequest = {
  client_id: 'cli-1',
  item_description: 'Nevera',
  price: '18500.00',
  down_payment: '0.00',
  installments: 12,
  frequency: 'mensual',
  first_due_date: '2026-11-17',
}

describe('pending-sale storage', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('guarda, lee y borra el intento por cliente', () => {
    expect(pendingSaleStorageKey('cli-1')).toBe('cobrafy.pendingSale:cli-1')
    expect(readPendingSale('cli-1')).toBeNull()
    writePendingSale('cli-1', { key: 'key-1', payload, snapshot })
    expect(readPendingSale('cli-1')).toEqual({ key: 'key-1', payload, snapshot })
    expect(readPendingSale('cli-2')).toBeNull()
    clearPendingSale('cli-1')
    expect(readPendingSale('cli-1')).toBeNull()
  })

  it('ignora JSON incompleto', () => {
    sessionStorage.setItem('cobrafy.pendingSale:cli-1', JSON.stringify({ key: '' }))
    expect(readPendingSale('cli-1')).toBeNull()
  })

  it('clearAllPendingSales borra todas las claves cobrafy.pendingSale:*', () => {
    writePendingSale('cli-1', { key: 'key-1', payload, snapshot })
    writePendingSale('cli-2', { key: 'key-2', payload, snapshot })
    sessionStorage.setItem('cobrafy.session', '{"token":"x"}')
    clearAllPendingSales()
    expect(readPendingSale('cli-1')).toBeNull()
    expect(readPendingSale('cli-2')).toBeNull()
    expect(sessionStorage.getItem('cobrafy.session')).toBe('{"token":"x"}')
  })

  it('solo 422 y 409 con código de negocio sueltan el pending', () => {
    expect(shouldReleasePendingSale(422)).toBe(true)
    expect(shouldReleasePendingSale(409, 'CLIENT_BLOCKED')).toBe(true)
    expect(shouldReleasePendingSale(409, 'IDEMPOTENCY_KEY_REUSED')).toBe(true)
    expect(shouldReleasePendingSale(409)).toBe(false)
    expect(shouldReleasePendingSale(400)).toBe(false)
    expect(shouldReleasePendingSale(401)).toBe(false)
    expect(shouldReleasePendingSale(403)).toBe(false)
    expect(shouldReleasePendingSale(404)).toBe(false)
    expect(shouldReleasePendingSale(408)).toBe(false)
    expect(shouldReleasePendingSale(429)).toBe(false)
    expect(shouldReleasePendingSale(500)).toBe(false)
    expect(shouldReleasePendingSale(0)).toBe(false)
  })
})
