import axios from 'axios'

type ErrorItem = { field: string | null; code: string; message: string }

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
  readonly codes: string[]

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
    code?: string,
    codes?: string[],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.code = code
    this.codes = codes ?? (code ? [code] : [])
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
  const codes = collectCodes(body)
  const code = codes[0] ?? errorCode(body)
  const message = parseMessage(body, status, code, fieldErrors)
  return new ApiError(message, status, fieldErrors, code, codes)
}

const INVITE_EMAIL_FAILED = 'No se pudo enviar el correo de invitación; puedes reenviarla.'

const DOCUMENT_UNREADABLE_MESSAGE =
  'No pudimos leer el documento del cliente. Revisa la ficha y vuelve a guardar el documento. Si sigue pasando, avísanos.'

const DOCUMENT_UNREADABLE_GUARANTOR_MESSAGE =
  'No pudimos leer el documento de un garante. Revisa los contactos del cliente y vuelve a guardarlo.'

const LEGACY_SALE_LEGAL_DATA_MISSING_MESSAGE =
  'Esta venta se registró sin RNC ni dirección del negocio.'

const SALE_ALREADY_VOIDED_MESSAGE = 'Esta venta ya estaba anulada.'

const SALE_HAS_PAYMENTS_MESSAGE = 'No se puede anular: la venta ya tiene pagos.'

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
  /\b(?:ya|este|esta|esto|estos|estas|para|está|están|debe|tienen?|existe|formato|revisa|inténtalo|sesión|permiso|bloqueo|bloqueado|anterior|motivo|correo|contraseña|cuotas?|atraso|venta|negocio|garante|cliente|documento|invitación|credenciales|válid\w*|inválid\w*|autorizado|autenticado|encontrado|recurso|conflicto|crédito|máximo|contactos|obligatorio|demasiados|intentos|pudimos|pudo|pudieron|completar|conexión|permitido)\b/i

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

function isGenericDetail(text: string, status: number): boolean {
  return status >= 500 || isTechnicalDetail(text) || isUnmappedEnglish(text)
}

function isClientCreateUrl(url = ''): boolean {
  const path = url.split('?')[0]?.replace(/\/$/, '') ?? ''
  return /\/clients$/.test(path)
}

function isDocumentConflictCode(code?: string): boolean {
  return (
    code === 'DOCUMENT_DUPLICATE' ||
    code === 'DOCUMENT_EXISTS' ||
    code === 'DOCUMENT_ALREADY_EXISTS' ||
    code === 'CLIENT_DOCUMENT_EXISTS'
  )
}

function isNewContractItem(item: unknown): item is ErrorItem {
  if (typeof item !== 'object' || item == null) return false
  const row = item as Record<string, unknown>
  const fieldOk = row.field === null || typeof row.field === 'string'
  return fieldOk && typeof row.code === 'string' && typeof row.message === 'string'
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

function rawDetailList(body: ErrorBody): unknown[] | null {
  if (Array.isArray(body.detail)) return body.detail
  if (Array.isArray(body.details)) return body.details
  return null
}

function listItems(body: ErrorBody): FastApiDetailItem[] | null {
  const raw = rawDetailList(body)
  if (!raw) return null
  const objects = raw.filter(
    (item): item is FastApiDetailItem => typeof item === 'object' && item != null,
  )
  const newest = objects.filter(isNewContractItem)
  return newest.length ? newest : objects
}

function collectCodes(body: ErrorBody): string[] {
  const items = listItems(body)
  const fromItems: string[] = []
  for (const item of items ?? []) {
    if (typeof item.code === 'string' && item.code.trim()) fromItems.push(item.code)
  }
  if (fromItems.length) return fromItems
  const fallback = fallbackCode(body)
  return fallback ? [fallback] : []
}

function fallbackCode(body: ErrorBody): string | undefined {
  if (typeof body.code === 'string' && body.code.trim()) return body.code
  if (body.detail && typeof body.detail === 'object' && !Array.isArray(body.detail)) {
    const nested = body.detail as { code?: unknown }
    if (typeof nested.code === 'string') return nested.code
  }
  return undefined
}

export function errorCode(body: ErrorBody): string | undefined {
  const items = listItems(body)
  if (items?.[0] && typeof items[0].code === 'string' && items[0].code.trim()) {
    return items[0].code
  }
  return fallbackCode(body)
}

function messageForCode(code: string | undefined): string | undefined {
  if (code === 'invite_email_failed') return INVITE_EMAIL_FAILED
  if (code === 'DOCUMENT_UNREADABLE') return DOCUMENT_UNREADABLE_MESSAGE
  if (code === 'DOCUMENT_UNREADABLE_GUARANTOR') return DOCUMENT_UNREADABLE_GUARANTOR_MESSAGE
  if (code === 'LEGACY_SALE_LEGAL_DATA_MISSING') return LEGACY_SALE_LEGAL_DATA_MISSING_MESSAGE
  if (code === 'SALE_ALREADY_VOIDED') return SALE_ALREADY_VOIDED_MESSAGE
  if (code === 'SALE_HAS_PAYMENTS') return SALE_HAS_PAYMENTS_MESSAGE
  return undefined
}

function itemMessage(item: FastApiDetailItem): string {
  if (isNewContractItem(item)) return item.message.trim()
  if (typeof item.message === 'string' && item.message.trim()) return item.message.trim()
  if (typeof item.msg === 'string' && item.msg.trim()) return item.msg.trim()
  return ''
}

function itemField(item: FastApiDetailItem): string | null {
  if (isNewContractItem(item)) {
    return typeof item.field === 'string' && item.field.trim() ? item.field : null
  }
  return detailField(item)
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
    const listMsg = itemMessage(items[0])
    if (listMsg) {
      return isGenericDetail(listMsg, status) ? GENERIC_MESSAGE : listMsg
    }
  }

  const raw = stringDetail(body)
  if (raw) {
    if (isGenericDetail(raw, status)) return GENERIC_MESSAGE
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
  const newest = (items ?? []).filter(isNewContractItem)

  if (items) {
    for (const row of items) {
      const field = itemField(row)
      const msg = itemMessage(row)
      if (field && msg && !errors[field] && !isGenericDetail(msg, status)) {
        errors[field] = msg
      }
    }
  }

  if (typeof body.field === 'string' && typeof body.message === 'string') {
    if (!isGenericDetail(body.message, status)) errors[body.field] = body.message
  }

  if (body.detail && typeof body.detail === 'object' && !Array.isArray(body.detail)) {
    const nested = body.detail as { field?: string; message?: string }
    if (nested.field && nested.message && !isGenericDetail(nested.message, status)) {
      errors[nested.field] = nested.message
    }
  }

  if (status === 409 && !Object.keys(errors).length) {
    if (newest.length) {
      const documentItem = newest.find((item) => isDocumentConflictCode(item.code))
      if (documentItem) {
        const msg = documentItem.message.trim()
        if (msg && !isGenericDetail(msg, status)) errors.document = msg
      }
      return errors
    }

    const code = errorCode(body)
    if (code === 'DOCUMENT_UNREADABLE' || code === 'DOCUMENT_UNREADABLE_GUARANTOR') {
      return errors
    }
    if (isDocumentConflictCode(code) || isClientCreateUrl(url)) {
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
  const parts = loc.filter(
    (part) => part !== 'body' && part !== 'query' && part !== 'path' && part !== 'header',
  )
  if (!parts.length) return null
  return parts.join('.')
}
