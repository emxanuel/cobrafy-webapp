import { ApiError, isApiError } from '@/features/shared/lib/api-error'

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
