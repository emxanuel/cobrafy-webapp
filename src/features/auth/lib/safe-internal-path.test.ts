import { describe, expect, it } from 'vitest'

import { safeInternalPath } from './safe-internal-path'

describe('safeInternalPath', () => {
  it('acepta rutas internas de la app', () => {
    expect(safeInternalPath('/clientes')).toBe('/clientes')
    expect(safeInternalPath('/clientes/cli-1')).toBe('/clientes/cli-1')
    expect(safeInternalPath('/equipo')).toBe('/equipo')
  })

  it('rechaza externas, protocol-relative y el token de invitación', () => {
    expect(safeInternalPath('https://evil.example/clientes')).toBeUndefined()
    expect(safeInternalPath('//evil.example')).toBeUndefined()
    expect(safeInternalPath('/\\evil.example')).toBeUndefined()
    expect(safeInternalPath('/invitar/secreto')).toBeUndefined()
    expect(safeInternalPath('/login')).toBeUndefined()
    expect(safeInternalPath('clientes')).toBeUndefined()
  })

  it('rechaza encodings y caracteres de control que saltan el origen', () => {
    expect(safeInternalPath('/%2F%2Fevil.example')).toBeUndefined()
    expect(safeInternalPath('/%5Cevil.example')).toBeUndefined()
    expect(safeInternalPath('/clientes\t')).toBeUndefined()
    expect(safeInternalPath('/clientes\n')).toBeUndefined()
  })
})
