import { describe, expect, it } from 'vitest'

import { extractInviteToken } from './extract-invite-token'

describe('extractInviteToken', () => {
  it('acepta el código suelto', () => {
    expect(extractInviteToken(' inv-ok ')).toBe('inv-ok')
  })

  it('acepta el enlace completo y la ruta relativa', () => {
    expect(extractInviteToken('https://app.local/invitar/inv-ok')).toBe('inv-ok')
    expect(extractInviteToken('https://app.local/invitar/inv-ok?utm=1')).toBe('inv-ok')
    expect(extractInviteToken('/invitar/inv-ok')).toBe('inv-ok')
    expect(extractInviteToken('invitar/inv-ok')).toBe('inv-ok')
  })

  it('acepta ?token= si no hay segmento de ruta', () => {
    expect(extractInviteToken('https://app.local/invitar?token=inv-ok')).toBe('inv-ok')
  })
})
