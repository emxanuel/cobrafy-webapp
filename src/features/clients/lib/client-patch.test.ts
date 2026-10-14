import { describe, expect, it } from 'vitest'

import { toClientPatch } from './client-patch'
import type { ClientRead } from '@/features/clients/services/types'

function client(overrides: Partial<ClientRead> = {}): ClientRead {
  return {
    id: 'cli-1',
    name: 'Ana Pérez',
    doc_type: 'cedula',
    document: '001-1234567-8',
    document_available: true,
    phone: '8095551111',
    address: 'Calle 1',
    notes: null,
    collector_membership_id: null,
    status: 'active',
    is_blocked: false,
    blocked_reason: null,
    ...overrides,
  }
}

describe('toClientPatch', () => {
  it('al cambiar solo el teléfono no manda document ni address ni doc_type', () => {
    const previous = client()
    const patch = toClientPatch(previous, {
      name: previous.name,
      doc_type: previous.doc_type,
      document: previous.document ?? '',
      phone: '8095559999',
      address: previous.address,
      notes: previous.notes,
      collector_membership_id: previous.collector_membership_id,
    })
    expect(patch).toEqual({ phone: '8095559999' })
    expect(patch).not.toHaveProperty('document')
    expect(patch).not.toHaveProperty('address')
    expect(patch).not.toHaveProperty('doc_type')
  })

  it('no manda document si la API lo ocultó', () => {
    const previous = client({
      document: '001-*****1234',
      document_available: false,
    })
    const patch = toClientPatch(previous, {
      name: previous.name,
      doc_type: 'pasaporte',
      document: '001-0000000-0',
      phone: previous.phone,
      address: previous.address,
    })
    expect(patch).not.toHaveProperty('document')
    expect(patch).not.toHaveProperty('doc_type')
  })
})
