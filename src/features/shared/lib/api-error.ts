import axios from 'axios'

type FastApiDetailItem = {
  loc?: Array<string | number>
  msg?: string
  type?: string
  field?: string | null
  code?: string
  message?: string
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

/** Backend PinLockedError: 401 `demasiados intentos; entra con contraseña`. */
export const PIN_LOCKED_DETAIL = 'demasiados intentos; entra con contraseña'

export function isPinLockedError(error: unknown): boolean {
  if (!isApiError(error) || error.status !== 401) return false
  return /demasiados intentos/i.test(error.message)
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
  const fieldErrors = parseFieldErrors(body, status, error.config?.url)
  const code = errorCode(body)
  const message = parseMessage(body, status, code, fieldErrors)
  return new ApiError(message, status, fieldErrors, code)
}

const INVITE_EMAIL_FAILED = 'No se pudo enviar el correo de invitación; puedes reenviarla.'

const DOCUMENT_UNREADABLE_MESSAGE =
  'No pudimos leer el documento del cliente. Revisa la ficha y vuelve a guardar el documento. Si sigue pasando, avísanos.'

const DOCUMENT_UNREADABLE_GUARANTOR_MESSAGE =
  'No pudimos leer el documento de un garante. Revisa los contactos del cliente y vuelve a guardarlo.'

export const GENERIC_MESSAGE = 'No se pudo completar. Inténtalo de nuevo.'

const TECHNICAL_DETAILS = new Set(
  [
    'not found',
    'method not allowed',
    'internal server error',
    'bad request',
    'unauthorized',
    'forbidden',
    'validation error',
    'unprocessable entity',
    'too many requests',
    'service unavailable',
    'bad gateway',
    'gateway timeout',
    'conflict',
    'unsupported media type',
    'request timeout',
    'http exception',
    'error',
  ].map((item) => item.toLowerCase()),
)

const SPANISH_DETAIL_WORD =
  /\b(?:el|la|los|las|un|una|unos|unas|de|del|al|no|se|ya|con|este|esta|esto|estos|estas|para|por|que|es|está|están|ser|debe|tienen?|existe|formato|revisa|inténtalo|sesión|permiso|bloqueo|bloqueado|anterior|motivo|correo|contraseña|cuota|venta|negocio|garante|cliente|documento|invitación|credenciales|válid\w*|inválid\w*)\b/i

function isTechnicalDetail(text: string): boolean {
  return TECHNICAL_DETAILS.has(text.trim().toLowerCase())
}

function isUnmappedEnglish(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (isTechnicalDetail(trimmed)) return true
  if (/[áéíóúñü¿¡]/i.test(trimmed)) return false
  if (SPANISH_DETAIL_WORD.test(trimmed)) return false
  return /[A-Za-z]/.test(trimmed)
}

function clientDocumentWriteUrl(url = ''): boolean {
  const path = url.split('?')[0]?.replace(/\/$/, '') ?? ''
  if (/\/clients$/.test(path)) return true
  return /\/clients\/(?!search$|check$)[^/]+$/.test(path)
}

function isDocumentConflictCode(code?: string): boolean {
  return (
    code === 'DOCUMENT_DUPLICATE' ||
    code === 'DOCUMENT_EXISTS' ||
    code === 'DOCUMENT_ALREADY_EXISTS' ||
    code === 'CLIENT_DOCUMENT_EXISTS'
  )
}

function stringDetail(body: ErrorBody): string | null {
  if (typeof body.detail === 'string' && body.detail.trim()) return body.detail.trim()
  if (typeof body.message === 'string' && body.message.trim()) return body.message.trim()
  if (body.detail && typeof body.detail === 'object' && !Array.isArray(body.detail)) {
    const nested = body.detail as { message?: string }
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nested.message.trim()
    }
  }
  return null
}

function listItems(body: ErrorBody): FastApiDetailItem[] | null {
  const raw = Array.isArray(body.detail)
    ? body.detail
    : Array.isArray(body.details)
      ? body.details
      : null
  if (!raw) return null
  return raw.filter((item): item is FastApiDetailItem => typeof item === 'object' && item != null)
}

export function errorCode(body: ErrorBody): string | undefined {
  const items = listItems(body)
  if (items?.[0] && typeof items[0].code === 'string' && items[0].code.trim()) {
    return items[0].code
  }
  if (typeof body.code === 'string') return body.code
  if (body.detail && typeof body.detail === 'object' && !Array.isArray(body.detail)) {
    const nested = body.detail as { code?: unknown }
    if (typeof nested.code === 'string') return nested.code
  }
  return undefined
}

function messageForCode(code: string | undefined): string | undefined {
  if (code === 'invite_email_failed') return INVITE_EMAIL_FAILED
  if (code === 'DOCUMENT_UNREADABLE') return DOCUMENT_UNREADABLE_MESSAGE
  if (code === 'DOCUMENT_UNREADABLE_GUARANTOR') return DOCUMENT_UNREADABLE_GUARANTOR_MESSAGE
  return undefined
}

export function parseMessage(
  body: ErrorBody,
  status: number,
  code = errorCode(body),
  fieldErrors: Record<string, string> = parseFieldErrors(body, status),
): string {
  const fromCode = messageForCode(code)
  if (fromCode) return fromCode

  const items = listItems(body)
  if (items?.[0]) {
    const first = items[0]
    if (typeof first.message === 'string' && first.message.trim()) {
      return first.message.trim()
    }
    if (typeof first.msg === 'string' && first.msg.trim()) {
      return first.msg.trim()
    }
  }

  const raw = stringDetail(body)
  if (raw) {
    if (status >= 500 || isTechnicalDetail(raw) || isUnmappedEnglish(raw)) return GENERIC_MESSAGE
    return raw
  }

  const fromFields = Object.values(fieldErrors)[0]
  if (fromFields) return fromFields
  if (code) return GENERIC_MESSAGE
  if (status === 401) return 'Tu sesión caducó. Entra de nuevo.'
  if (status === 403) return 'No tienes permiso para hacer esto.'
  if (status === 422) return 'Revisa los datos marcados.'
  return GENERIC_MESSAGE
}

export function parseFieldErrors(body: ErrorBody, status = 0, url = ''): Record<string, string> {
  const errors: Record<string, string> = {}
  const items = listItems(body)

  if (items) {
    for (const row of items) {
      const field = detailField(row)
      const msg = (row.message ?? row.msg)?.trim()
      if (field && msg && !errors[field]) errors[field] = msg
    }
  }

  if (typeof body.field === 'string' && typeof body.message === 'string') {
    errors[body.field] = body.message
  }

  if (body.detail && typeof body.detail === 'object' && !Array.isArray(body.detail)) {
    const nested = body.detail as { field?: string; message?: string }
    if (nested.field && nested.message) {
      errors[nested.field] = nested.message
    }
  }

  if (status === 409 && !Object.keys(errors).length) {
    const code = errorCode(body)
    if (code === 'DOCUMENT_UNREADABLE' || code === 'DOCUMENT_UNREADABLE_GUARANTOR') {
      return errors
    }
    if (isDocumentConflictCode(code) || clientDocumentWriteUrl(url)) {
      errors.document =
        typeof body.detail === 'string' && body.detail.trim()
          ? body.detail
          : 'ya existe un cliente con este documento'
    }
  }

  return errors
}

function detailField(row: FastApiDetailItem): string | null {
  if (typeof row.field === 'string' && row.field.trim()) return row.field
  return locToField(row.loc)
}

function locToField(loc: FastApiDetailItem['loc']): string | null {
  if (!loc?.length) return null
  const parts = loc.filter((part) => part !== 'body' && part !== 'query')
  if (!parts.length) return null
  return parts.join('.')
}
