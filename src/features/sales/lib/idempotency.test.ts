import { describe, expect, it } from 'vitest'

import { idempotencyForForm } from './idempotency'

describe('idempotencyForForm', () => {
  it('reusa la clave si el formulario no cambió', () => {
    const first = idempotencyForForm(null, 'a|b', () => 'key-1')
    const retry = idempotencyForForm(first, 'a|b', () => 'key-2')
    expect(retry.key).toBe('key-1')
  })

  it('renueva la clave si cambió el formulario', () => {
    const first = idempotencyForForm(null, 'a|b', () => 'key-1')
    const next = idempotencyForForm(first, 'a|c', () => 'key-2')
    expect(next.key).toBe('key-2')
  })
})
