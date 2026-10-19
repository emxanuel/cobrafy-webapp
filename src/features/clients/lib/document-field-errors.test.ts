import { describe, expect, it } from 'vitest'

import { ApiError } from '@/features/shared/lib/api-error'

import {
  CONTACT_EDITOR_FIELDS,
  hasUnrenderedFieldError,
  isClientFormField,
  remapContactDocumentError,
} from './document-field-errors'

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

  it('foo y guarantors.1.document no están renderizados en el form de cliente', () => {
    expect(isClientFormField('document')).toBe(true)
    expect(isClientFormField('contacts.1.document')).toBe(true)
    expect(isClientFormField('foo')).toBe(false)
    expect(isClientFormField('guarantors.1.document')).toBe(false)
    expect(
      hasUnrenderedFieldError({ foo: 'x' }, isClientFormField),
    ).toBe(true)
    expect(
      hasUnrenderedFieldError({ 'guarantors.1.document': 'x' }, isClientFormField),
    ).toBe(true)
    expect(hasUnrenderedFieldError({ document: 'x' }, isClientFormField)).toBe(false)
  })

  it('doc_type, address y type no están en el set del composer/card', () => {
    expect(CONTACT_EDITOR_FIELDS.has('document')).toBe(true)
    expect(CONTACT_EDITOR_FIELDS.has('doc_type')).toBe(false)
    expect(CONTACT_EDITOR_FIELDS.has('address')).toBe(false)
    expect(CONTACT_EDITOR_FIELDS.has('type')).toBe(false)
    expect(hasUnrenderedFieldError({ foo: 'x' }, (field) => CONTACT_EDITOR_FIELDS.has(field))).toBe(
      true,
    )
  })
})
