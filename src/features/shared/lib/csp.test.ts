import { describe, expect, it } from 'vitest'

import { buildContentSecurityPolicy, resolveApiOrigin } from './csp'

describe('buildContentSecurityPolicy', () => {
  it('deja connect-src en self si la URL es relativa o vacía', () => {
    expect(resolveApiOrigin(undefined)).toBeNull()
    expect(resolveApiOrigin('')).toBeNull()
    expect(resolveApiOrigin('/api')).toBeNull()
    const csp = buildContentSecurityPolicy({ production: true })
    expect(csp).toContain("connect-src 'self'")
    expect(csp).not.toMatch(/connect-src 'self' http/)
    expect(csp).toContain('upgrade-insecure-requests')
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('añade el origen absoluto a connect-src', () => {
    const httpsCsp = buildContentSecurityPolicy({
      apiBaseUrl: 'https://api.cobrafy.test/v1',
      production: true,
    })
    expect(httpsCsp).toContain("connect-src 'self' https://api.cobrafy.test")
    expect(httpsCsp).toContain('upgrade-insecure-requests')

    const httpCsp = buildContentSecurityPolicy({
      apiBaseUrl: 'http://127.0.0.1:8000',
      production: true,
    })
    expect(httpCsp).toContain("connect-src 'self' http://127.0.0.1:8000")
    expect(httpCsp).not.toContain('upgrade-insecure-requests')
  })

  it('no emite upgrade-insecure-requests fuera de producción', () => {
    const csp = buildContentSecurityPolicy({
      apiBaseUrl: 'https://api.cobrafy.test',
      production: false,
    })
    expect(csp).not.toContain('upgrade-insecure-requests')
  })
})
