import { describe, expect, it } from 'vitest'

import { failedContactsNotice } from './failed-contacts-notice'

describe('failedContactsNotice', () => {
  it('nombra el contacto en singular y en plural', () => {
    expect(failedContactsNotice(['Pedro Gómez'])).toContain('el contacto Pedro Gómez')
    expect(failedContactsNotice(['Pedro Gómez', 'Ana'])).toContain(
      'los contactos Pedro Gómez y Ana',
    )
    expect(failedContactsNotice(['A', 'B', 'C'])).toContain('los contactos A, B y C')
  })
})
