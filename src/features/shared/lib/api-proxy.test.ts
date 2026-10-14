import { describe, expect, it } from 'vitest'

import { matchesApiProxy } from './api-proxy'

describe('api proxy prefixes', () => {
  it('no captura /auditoria ni /clientes', () => {
    expect(matchesApiProxy('/audit', 'audit')).toBe(true)
    expect(matchesApiProxy('/audit?page=1', 'audit')).toBe(true)
    expect(matchesApiProxy('/audit/extra', 'audit')).toBe(true)
    expect(matchesApiProxy('/auditoria', 'audit')).toBe(false)
    expect(matchesApiProxy('/auditoria?page=1', 'audit')).toBe(false)

    expect(matchesApiProxy('/clients', 'clients')).toBe(true)
    expect(matchesApiProxy('/clients/cli-1', 'clients')).toBe(true)
    expect(matchesApiProxy('/clientes', 'clients')).toBe(false)
    expect(matchesApiProxy('/clientes/cli-1', 'clients')).toBe(false)
  })
})
