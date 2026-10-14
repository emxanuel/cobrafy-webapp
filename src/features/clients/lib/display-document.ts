import type { Role } from '@/features/auth/services/types'
import type { DocType } from '@/features/clients/services/types'
import { isAlreadyMaskedDocument, maskDocument } from '@/features/shared/lib/mask-document'

export function documentTypeLabel(docType: DocType | null | undefined): string {
  return docType === 'pasaporte' ? 'Pasaporte' : 'Cédula'
}

export function displayDocument(doc: string | null | undefined, role: Role | null): string {
  if (!doc) return '—'
  if (role === 'cobrador' && !isAlreadyMaskedDocument(doc)) {
    return maskDocument(doc)
  }
  return doc
}

export function formatDocumentLine(
  docType: DocType | null | undefined,
  doc: string | null | undefined,
  role: Role | null,
): string {
  return `${documentTypeLabel(docType)} ${displayDocument(doc, role)}`
}
