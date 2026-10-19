import { describe, expect, it } from 'vitest'

import { formFieldFromApiField, mapApiFieldErrors } from './document-field-errors'

describe('document field errors (CBF-215)', () => {
  it('deja document en el input del cliente', () => {
    expect(formFieldFromApiField('document', [])).toBe('document')
  })

  it('el garante de índice 1 ignora las referencias', () => {
    const contacts = [
      { type: 'referencia' },
      { type: 'garante' },
      { type: 'garante' },
    ]
    expect(formFieldFromApiField('guarantors.1.document', contacts)).toBe(
      'contacts.2.document',
    )
  })

  it('si solo hay garantes, el índice coincide con contacts', () => {
    const contacts = [{ type: 'garante' }, { type: 'garante' }]
    expect(formFieldFromApiField('guarantors.1.document', contacts)).toBe(
      'contacts.1.document',
    )
  })

  it('mapea varios fieldErrors conservando el primero de cada campo', () => {
    expect(
      mapApiFieldErrors(
        {
          document: 'Cédula no válida. Revisa los 11 dígitos.',
          'guarantors.1.document': 'Pasaporte no válido. Usa de 6 a 20 letras o números.',
        },
        [{ type: 'garante' }, { type: 'garante' }],
      ),
    ).toEqual({
      document: 'Cédula no válida. Revisa los 11 dígitos.',
      'contacts.1.document': 'Pasaporte no válido. Usa de 6 a 20 letras o números.',
    })
  })
})
