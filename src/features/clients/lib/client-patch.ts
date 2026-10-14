import type { ClientCreate, ClientRead, ClientUpdate } from '@/features/clients/services/types'

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? '') === (right ?? '')
}

/** PATCH body with only changed fields. Never sends document unless it changed, and never when the API hid it. */
export function toClientPatch(previous: ClientRead, next: ClientCreate): ClientUpdate {
  const patch: ClientUpdate = {}
  if (next.name !== previous.name) patch.name = next.name
  if (next.phone !== previous.phone) patch.phone = next.phone
  if (!sameText(next.address, previous.address)) patch.address = next.address
  if (!sameText(next.notes, previous.notes)) patch.notes = next.notes ?? null
  if ((next.collector_membership_id ?? null) !== (previous.collector_membership_id ?? null)) {
    patch.collector_membership_id = next.collector_membership_id ?? null
  }

  const canSeeDocument = previous.document_available !== false
  if (canSeeDocument) {
    if (!sameText(next.document, previous.document)) patch.document = next.document
    if (next.doc_type !== previous.doc_type) patch.doc_type = next.doc_type
  }

  return patch
}
