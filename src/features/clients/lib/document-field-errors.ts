import { ApiError, isApiError } from '@/features/shared/lib/api-error'
import type { ClientRead, ContactRead } from '@/features/clients/services/types'

export const CLIENT_FORM_FIELDS = new Set([
  'name',
  'doc_type',
  'document',
  'phone',
  'collector_membership_id',
  'address',
])

const CONTACT_ROW_DOCUMENT = /^contacts\.(\d+)\.document$/

export const CONTACT_EDITOR_FIELDS = new Set(['name', 'phone', 'relationship', 'document'])

export function isClientFormField(field: string, contactCount: number): boolean {
  const row = CONTACT_ROW_DOCUMENT.exec(field)
  if (row) {
    const index = parseInt(row[1] ?? '', 10)
    return index >= 0 && index < contactCount
  }
  return CLIENT_FORM_FIELDS.has(field)
}

export function hasUnrenderedFieldError(
  fieldErrors: Record<string, string>,
  isRendered: (field: string) => boolean,
): boolean {
  return unrenderedFieldMessages(fieldErrors, isRendered).length > 0
}

export function unrenderedFieldMessages(
  fieldErrors: Record<string, string>,
  isRendered: (field: string) => boolean,
): string[] {
  return Object.entries(fieldErrors)
    .filter(([field]) => !isRendered(field))
    .map(([, message]) => message)
}

/** Client and some contacts already saved; retry must not POST them again. */
export class PartialClientSaveError extends ApiError {
  readonly savedClient: ClientRead
  readonly createdByIndex: Record<number, ContactRead>

  constructor(
    cause: ApiError,
    savedClient: ClientRead,
    createdByIndex: Record<number, ContactRead>,
  ) {
    super(cause.message, cause.status, cause.fieldErrors, cause.code, cause.codes)
    this.name = 'PartialClientSaveError'
    this.savedClient = savedClient
    this.createdByIndex = createdByIndex
  }
}

export function isPartialClientSaveError(error: unknown): error is PartialClientSaveError {
  return error instanceof PartialClientSaveError
}

/** Contacts POST/PATCH emit `field: 'document'`. Map it onto the row that made the call. */
export function remapContactDocumentError(
  error: unknown,
  contactIndex: number,
): ApiError | null {
  if (!isApiError(error)) return null
  const message = error.fieldErrors.document
  if (!message) return null
  return new ApiError(
    error.message,
    error.status,
    { [`contacts.${contactIndex}.document`]: message },
    error.code,
    error.codes,
  )
}
