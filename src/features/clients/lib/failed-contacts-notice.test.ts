import { describe, expect, it } from 'vitest'

import { failedContactsNotice, parseContactsSaveNotice } from './failed-contacts-notice'

describe('failedContactsNotice', () => {
  it('distingue quitar, editar y agregar', () => {
    expect(failedContactsNotice([{ name: 'Pedro Gómez', op: 'add' }])).toContain(
      'No se pudo agregar a Pedro Gómez',
    )
    expect(failedContactsNotice([{ name: 'Ana', op: 'edit' }])).toContain(
      'No se pudo guardar el cambio de Ana',
    )
    expect(failedContactsNotice([{ name: 'Luis', op: 'remove' }])).toContain(
      'No se pudo quitar a Luis',
    )
  })

  it('en un 401 nombra lo que ya se aplicó', () => {
    const message = failedContactsNotice([{ name: 'Ana', op: 'remove' }], {
      applied: [{ name: 'Luis', op: 'remove' }],
      stoppedOnUnauthorized: true,
    })
    expect(message).toContain('Se quitó a Luis')
    expect(message).toContain('No se pudo quitar a Ana')
    expect(message).toContain('Tu sesión caducó')
  })

  it('parsea avisos con applied y el formato viejo', () => {
    expect(
      parseContactsSaveNotice(
        JSON.stringify({
          failed: [{ name: 'Ana', op: 'edit' }],
          applied: [{ name: 'Luis', op: 'remove' }],
          stoppedOnUnauthorized: true,
        }),
      ),
    ).toEqual({
      failed: [{ name: 'Ana', op: 'edit' }],
      applied: [{ name: 'Luis', op: 'remove' }],
      stoppedOnUnauthorized: true,
    })
    expect(
      parseContactsSaveNotice(
        JSON.stringify([
          { name: 'Pedro Gómez', op: 'add' },
          { name: 'sin-op' },
          'Pedro Gómez',
        ]),
      ),
    ).toEqual({
      failed: [{ name: 'Pedro Gómez', op: 'add' }],
      applied: [],
      stoppedOnUnauthorized: false,
    })
    expect(parseContactsSaveNotice('no-json')).toEqual({
      failed: [],
      applied: [],
      stoppedOnUnauthorized: false,
    })
    expect(parseContactsSaveNotice(null)).toEqual({
      failed: [],
      applied: [],
      stoppedOnUnauthorized: false,
    })
  })
})
