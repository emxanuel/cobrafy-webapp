import axios from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { toApiError } from '@/features/shared/lib/api-error'
import type { SaleCreateRequest } from '@/features/sales/services/types'
import type { SaleFormSnapshot } from '@/features/sales/lib/sale-payload'

import {
  PENDING_SALE_TTL_MS,
  clearAllPendingSales,
  clearPendingSale,
  isPendingSaleExpired,
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
    expect(readPendingSale('cli-1')).toMatchObject({ key: 'key-1', payload, snapshot })
    expect(readPendingSale('cli-1')?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
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

  it('un 422 o 409 con código en la forma nueva también sueltan el pending', () => {
    const axios422 = new axios.AxiosError(
      'Request failed',
      '422',
      { headers: new axios.AxiosHeaders(), url: '/sales' },
      undefined,
      {
        status: 422,
        data: {
          detail: [
            { field: 'price', code: 'value_error', message: 'El precio debe ser mayor que cero' },
          ],
        },
        statusText: '',
        headers: {},
        config: { headers: new axios.AxiosHeaders(), url: '/sales' },
      },
    )
    const err422 = toApiError(axios422)
    expect(shouldReleasePendingSale(err422.status, err422.code)).toBe(true)

    const axios409 = new axios.AxiosError(
      'Request failed',
      '409',
      { headers: new axios.AxiosHeaders(), url: '/sales' },
      undefined,
      {
        status: 409,
        data: {
          detail: [{ field: null, code: 'CLIENT_BLOCKED', message: 'Este cliente está bloqueado' }],
        },
        statusText: '',
        headers: {},
        config: { headers: new axios.AxiosHeaders(), url: '/sales' },
      },
    )
    const err409 = toApiError(axios409)
    expect(err409.code).toBe('CLIENT_BLOCKED')
    expect(shouldReleasePendingSale(err409.status, err409.code)).toBe(true)
  })

  it('sin created_at o con fecha inválida el pending está vencido', () => {
    expect(isPendingSaleExpired({ created_at: '' })).toBe(true)
    expect(isPendingSaleExpired({ created_at: 'not-a-date' })).toBe(true)
    sessionStorage.setItem(
      pendingSaleStorageKey('cli-1'),
      JSON.stringify({ key: 'key-1', payload, snapshot }),
    )
    const missing = readPendingSale('cli-1')
    expect(missing?.created_at).toBe('')
    expect(isPendingSaleExpired(missing!)).toBe(true)
    sessionStorage.setItem(
      pendingSaleStorageKey('cli-1'),
      JSON.stringify({ key: 'key-1', payload, snapshot, created_at: 'ayer' }),
    )
    const invalid = readPendingSale('cli-1')
    expect(invalid?.created_at).toBe('ayer')
    expect(isPendingSaleExpired(invalid!)).toBe(true)
  })

  it('un created_at en el futuro está vencido', () => {
    expect(
      isPendingSaleExpired({ created_at: new Date(Date.now() + 60_000).toISOString() }),
    ).toBe(true)
  })

  it('a las 23 h el pending está vencido', () => {
    vi.useFakeTimers()
    const created_at = new Date().toISOString()
    expect(isPendingSaleExpired({ created_at })).toBe(false)
    vi.advanceTimersByTime(PENDING_SALE_TTL_MS - 1)
    expect(isPendingSaleExpired({ created_at })).toBe(false)
    vi.advanceTimersByTime(1)
    expect(isPendingSaleExpired({ created_at })).toBe(true)
    vi.useRealTimers()
  })
})
