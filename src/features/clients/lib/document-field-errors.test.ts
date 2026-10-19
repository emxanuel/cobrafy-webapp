import { describe, expect, it } from 'vitest'

import { ApiError } from '@/features/shared/lib/api-error'

import { remapContactDocumentError } from './document-field-errors'

describe('document field errors (CBF-215)', () => {
  it('el 422 de POST/PATCH contacts va al document del contacto que llamó', () => {
    const error = new ApiError(
      'Cédula no válida. Revisa los 11 dígitos.',
      422,
      { document: 'Cédula no válida. Revisa los 11 dígitos.' },
      'value_error',
    )
    const remapped = remapContactDocumentError(error, 1)
    expect(remapped?.fieldErrors).toEqual({
      'contacts.1.document': 'Cédula no válida. Revisa los 11 dígitos.',
    })
    expect(remapped?.fieldErrors.document).toBeUndefined()
  })

  it('un error sin field document no se remapea', () => {
    const error = new ApiError('No se pudo completar. Inténtalo de nuevo.', 500)
    expect(remapContactDocumentError(error, 0)).toBeNull()
  })
})
