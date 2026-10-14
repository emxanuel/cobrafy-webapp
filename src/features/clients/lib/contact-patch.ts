import type {
  ContactCreate,
  ContactDraft,
  ContactRead,
  ContactUpdate,
} from '@/features/clients/services/types'

export function toContactCreate(item: ContactDraft): ContactCreate {
  return {
    type: item.type,
    name: item.name,
    phone: item.phone,
    relationship: item.relationship,
    address: item.address ?? null,
    doc_type: item.doc_type || null,
    document: item.document ?? null,
  }
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? '') === (right ?? '')
}

/** PATCH body with only changed fields. Never sends document unless it changed, and never when the API hid it. */
export function toContactPatch(previous: ContactRead, next: ContactDraft): ContactUpdate {
  const patch: ContactUpdate = {}
  if (next.type !== previous.type) patch.type = next.type
  if (next.name !== previous.name) patch.name = next.name
  if (next.phone !== previous.phone) patch.phone = next.phone
  if (next.relationship !== previous.relationship) patch.relationship = next.relationship
  if (next.address !== undefined && !sameText(next.address, previous.address)) {
    patch.address = next.address?.trim() ? next.address : null
  }

  const canSeeDocument = previous.document_available !== false
  if (canSeeDocument) {
    if (next.document !== undefined && !sameText(next.document, previous.document)) {
      patch.document = next.document?.trim() ? next.document : null
    }
    if (next.doc_type !== undefined) {
      const nextType = next.doc_type || null
      const prevType = previous.doc_type ?? null
      if (nextType !== prevType) patch.doc_type = nextType
    }
  }

  return patch
}

export function contactUnchanged(previous: ContactRead, next: ContactDraft): boolean {
  return Object.keys(toContactPatch(previous, next)).length === 0
}
