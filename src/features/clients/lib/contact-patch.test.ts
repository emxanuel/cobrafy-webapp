import { describe, expect, it } from 'vitest'

import { toContactPatch } from './contact-patch'
import type { ContactRead } from '@/features/clients/services/types'

function contact(overrides: Partial<ContactRead> = {}): ContactRead {
  return {
    id: 'ct-1',
    client_id: 'cli-1',
    type: 'referencia',
    name: 'Ref Uno',
    phone: '8095550001',
    relationship: 'Prima',
    address: 'Calle 1',
    doc_type: 'cedula',
    document: '001-1234567-8',
    has_document: true,
    document_available: true,
    is_active: true,
    ...overrides,
  }
}

describe('toContactPatch', () => {
  it('al cambiar solo el teléfono no manda document, address ni doc_type', () => {
    const previous = contact()
    const patch = toContactPatch(previous, {
      type: previous.type,
      name: previous.name,
      phone: '8095559999',
      relationship: previous.relationship,
      address: previous.address,
      doc_type: previous.doc_type,
      document: previous.document,
    })
    expect(patch).toEqual({ phone: '8095559999' })
    expect(patch).not.toHaveProperty('document')
    expect(patch).not.toHaveProperty('address')
    expect(patch).not.toHaveProperty('doc_type')
  })

  it('no manda document si la API lo ocultó', () => {
    const previous = contact({
      document: '001-*****1234',
      document_available: false,
    })
    const patch = toContactPatch(previous, {
      type: previous.type,
      name: previous.name,
      phone: previous.phone,
      relationship: previous.relationship,
      document: '001-0000000-0',
      doc_type: 'pasaporte',
    })
    expect(patch).not.toHaveProperty('document')
    expect(patch).not.toHaveProperty('doc_type')
  })
})
