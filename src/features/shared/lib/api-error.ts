import axios from 'axios'

type FastApiDetailItem = {
  loc?: Array<string | number>
  msg?: string
  type?: string
}

type ErrorBody = {
  detail?: unknown
  error?: string
  message?: string
  details?: unknown
  field?: string
  code?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>
  readonly code?: string

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
    code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.code = code
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'No se pudo completar. Inténtalo de nuevo.',
): string {
  if (isApiError(error)) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (isApiError(error)) return error.fieldErrors
  return {}
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error
  if (!axios.isAxiosError(error)) {
    return new ApiError(getApiErrorMessage(error), 0)
  }

  const status = error.response?.status ?? 0
  const body = (error.response?.data ?? {}) as ErrorBody
  const fieldErrors = parseFieldErrors(body, status)
  const message = parseMessage(body, status)
  const code = typeof body.code === 'string' ? body.code : undefined
  return new ApiError(message, status, fieldErrors, code)
}

function parseMessage(body: ErrorBody, status: number): string {
  if (typeof body.message === 'string' && body.message.trim()) {
    return body.message
  }
  if (typeof body.detail === 'string' && body.detail.trim()) {
    return body.detail
  }
  if (body.detail && typeof body.detail === 'object' && !Array.isArray(body.detail)) {
    const nested = body.detail as { message?: string }
    if (typeof nested.message === 'string') return nested.message
  }
  const fromFields = Object.values(parseFieldErrors(body, status))[0]
  if (fromFields) return fromFields
  if (status === 401) return 'Tu sesión caducó. Entra de nuevo.'
  if (status === 403) return 'No tienes permiso para hacer esto.'
  if (status === 409) return 'Ese dato ya está registrado.'
  if (status === 422) return 'Revisa los datos marcados.'
  return 'No se pudo completar. Inténtalo de nuevo.'
}

function parseFieldErrors(body: ErrorBody, status: number): Record<string, string> {
  const errors: Record<string, string> = {}
  const details = Array.isArray(body.detail)
    ? body.detail
    : Array.isArray(body.details)
      ? body.details
      : null

  if (details) {
    for (const item of details) {
      if (typeof item === 'string') continue
      const row = item as FastApiDetailItem
      const field = locToField(row.loc)
      const msg = row.msg?.trim()
      if (field && msg && !errors[field]) errors[field] = msg
    }
  }

  if (typeof body.field === 'string' && typeof body.message === 'string') {
    errors[body.field] = body.message
  }

  if (
    body.detail &&
    typeof body.detail === 'object' &&
    !Array.isArray(body.detail)
  ) {
    const nested = body.detail as { field?: string; message?: string }
    if (nested.field && nested.message) {
      errors[nested.field] = nested.message
    }
  }

  if (status === 409 && !Object.keys(errors).length) {
    const text =
      (typeof body.detail === 'string' ? body.detail : '') +
      ' ' +
      (typeof body.message === 'string' ? body.message : '') +
      ' ' +
      (typeof body.code === 'string' ? body.code : '')
    if (/document|cédula|cedula|pasaporte/i.test(text)) {
      errors.document_number = typeof body.detail === 'string'
        ? body.detail
        : 'Ya hay un cliente con este documento.'
    }
  }

  return errors
}

function locToField(loc: FastApiDetailItem['loc']): string | null {
  if (!loc?.length) return null
  const parts = loc.filter((part) => part !== 'body' && part !== 'query')
  if (!parts.length) return null
  return parts.join('.')
}
