import { afterEach, describe, expect, it } from 'vitest'

import {
  IDEMPOTENCY_STORAGE_PREFIX,
  clearAllSaleIdempotencyKeys,
  clearIdempotencyKey,
  idempotencyForForm,
  idempotencyStorageKey,
  readIdempotencyKey,
} from './idempotency'

describe('idempotencyForForm', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('reusa la clave si el formulario no cambió', () => {
    const first = idempotencyForForm(null, 'a|b', () => 'key-1')
    const retry = idempotencyForForm(first, 'a|b', () => 'key-2')
    expect(retry.key).toBe('key-1')
    expect(readIdempotencyKey('a|b')).toBe('key-1')
  })

  it('renueva la clave si cambió el payload', () => {
    const first = idempotencyForForm(null, 'a|b', () => 'key-1')
    const next = idempotencyForForm(first, 'a|c', () => 'key-2')
    expect(next.key).toBe('key-2')
    expect(readIdempotencyKey('a|b')).toBe('key-1')
    expect(readIdempotencyKey('a|c')).toBe('key-2')
  })

  it('recupera la clave del sessionStorage por fingerprint', () => {
    idempotencyForForm(null, 'body-1', () => 'stored-key')
    const restored = idempotencyForForm(null, 'body-1', () => 'other')
    expect(restored.key).toBe('stored-key')
    expect(sessionStorage.getItem(idempotencyStorageKey('body-1'))).toContain('stored-key')
  })

  it('olvidar la clave obliga a mintar otra', () => {
    idempotencyForForm(null, 'body-1', () => 'old')
    clearIdempotencyKey('body-1')
    const next = idempotencyForForm(null, 'body-1', () => 'new')
    expect(next.key).toBe('new')
  })

  it('clearAllSaleIdempotencyKeys borra cobrafy.saleIdempotency:*', () => {
    idempotencyForForm(null, 'body-1', () => 'key-1')
    idempotencyForForm(null, 'body-2', () => 'key-2')
    sessionStorage.setItem('cobrafy.session', '{"token":"x"}')
    clearAllSaleIdempotencyKeys()
    expect(readIdempotencyKey('body-1')).toBeNull()
    expect(readIdempotencyKey('body-2')).toBeNull()
    expect(sessionStorage.getItem(`${IDEMPOTENCY_STORAGE_PREFIX}body-1`)).toBeNull()
    expect(sessionStorage.getItem('cobrafy.session')).toBe('{"token":"x"}')
  })
})
