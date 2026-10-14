import { describe, expect, it } from 'vitest'

import { failedContactsNotice, parseFailedContacts } from './failed-contacts-notice'

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

  it('parsea solo contactos con operación conocida', () => {
    expect(
      parseFailedContacts(
        JSON.stringify([
          { name: 'Pedro Gómez', op: 'add' },
          { name: 'sin-op' },
          'Pedro Gómez',
        ]),
      ),
    ).toEqual([{ name: 'Pedro Gómez', op: 'add' }])
    expect(parseFailedContacts('no-json')).toEqual([])
    expect(parseFailedContacts(null)).toEqual([])
  })
})
