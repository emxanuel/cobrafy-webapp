import { afterEach, describe, expect, it } from 'vitest'

import type { SaleCreateRequest } from '@/features/sales/services/types'
import type { SaleFormSnapshot } from '@/features/sales/lib/sale-payload'

import {
  clearPendingSale,
  pendingSaleStorageKey,
  readPendingSale,
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
})
