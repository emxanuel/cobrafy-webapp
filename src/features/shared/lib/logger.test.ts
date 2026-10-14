import { describe, expect, it } from 'vitest'

import { redactPath } from './logger'

describe('redactPath', () => {
  it('oculta el token de /invitar/:token', () => {
    expect(redactPath('/invitar/inv-ok-super-secreto')).toBe('/invitar/:token')
    expect(redactPath('https://app.local/invitar/abc123xyz')).toBe(
      'https://app.local/invitar/:token',
    )
  })

  it('no deja el token en query ni en el fragmento', () => {
    expect(redactPath('/invitar/abc?token=otro')).toBe('/invitar/:token')
    expect(redactPath('/login?token=abc')).toBe('/login')
  })
})
