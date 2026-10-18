import axios from 'axios'
import { describe, expect, it } from 'vitest'

import { ApiError, isPinLockedError, PIN_LOCKED_DETAIL, toApiError } from './api-error'

function axiosError(status: number, data: unknown) {
  return new axios.AxiosError(
    'Request failed',
    String(status),
    undefined,
    undefined,
    {
      status,
      data,
      statusText: '',
      headers: {},
      config: { headers: new axios.AxiosHeaders() },
    },
  )
}

describe('toApiError', () => {
  it('mapea 422 de FastAPI al campo sin usar input', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          {
            loc: ['body', 'document'],
            msg: 'El formato de la cédula no es válido.',
            type: 'value_error',
          },
        ],
      }),
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error.fieldErrors.document).toBe('El formato de la cédula no es válido.')
    expect(error.message).toBe('El formato de la cédula no es válido.')
  })

  it('mapea 422 con field al campo, no al texto', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          {
            field: 'down_payment',
            code: 'DOWN_PAYMENT_INVALID',
            message: 'La inicial debe ser menor que el precio.',
          },
        ],
      }),
    )
    expect(error.code).toBe('DOWN_PAYMENT_INVALID')
    expect(error.fieldErrors.down_payment).toBe('La inicial debe ser menor que el precio.')
    expect(error.message).toBe('La inicial debe ser menor que el precio.')
  })

  it('un 409 en lista con field null va al banner, no a un campo', () => {
    const error = toApiError(
      axiosError(409, {
        detail: [
          {
            field: null,
            code: 'CREDIT_SETTINGS_MISSING',
            message: 'Todavía no has configurado el crédito del negocio.',
          },
        ],
      }),
    )
    expect(error.code).toBe('CREDIT_SETTINGS_MISSING')
    expect(error.fieldErrors).toEqual({})
    expect(error.message).toBe('Todavía no has configurado el crédito del negocio.')
  })

  it('lee DOCUMENT_UNREADABLE por código, no por texto', () => {
    const error = toApiError(
      axiosError(409, {
        detail: [
          {
            field: null,
            code: 'DOCUMENT_UNREADABLE',
            message: 'no se pudo descifrar',
          },
        ],
      }),
    )
    expect(error.code).toBe('DOCUMENT_UNREADABLE')
    expect(error.fieldErrors).toEqual({})
    expect(error.message).toBe(
      'No pudimos leer el documento del cliente. Revisa la ficha y vuelve a guardar el documento. Si sigue pasando, avísanos.',
    )
  })

  it('lee DOCUMENT_UNREADABLE_GUARANTOR por código', () => {
    const error = toApiError(
      axiosError(409, {
        detail: [{ field: null, code: 'DOCUMENT_UNREADABLE_GUARANTOR', message: 'crypto' }],
      }),
    )
    expect(error.code).toBe('DOCUMENT_UNREADABLE_GUARANTOR')
    expect(error.message).toBe(
      'No pudimos leer el documento de un garante. Revisa los contactos del cliente y vuelve a guardarlo.',
    )
  })

  it('un 409 de texto plano sigue siendo banner', () => {
    const error = toApiError(
      axiosError(409, {
        detail: 'ya existe un cliente con este documento',
      }),
    )
    expect(error.fieldErrors).toEqual({})
    expect(error.code).toBeUndefined()
    expect(error.message).toBe('ya existe un cliente con este documento')
  })

  it('IDEMPOTENCY_KEY_REUSED es un error genérico', () => {
    const error = toApiError(
      axiosError(409, {
        detail: [{ field: null, code: 'IDEMPOTENCY_KEY_REUSED', message: 'key reused' }],
      }),
    )
    expect(error.code).toBe('IDEMPOTENCY_KEY_REUSED')
    expect(error.message).toBe('No se pudo completar. Inténtalo de nuevo.')
  })

  it('un código desconocido sin mensaje cae al genérico en español', () => {
    const error = toApiError(
      axiosError(409, {
        detail: [{ field: null, code: 'SOME_NEW_CODE' }],
      }),
    )
    expect(error.code).toBe('SOME_NEW_CODE')
    expect(error.message).toBe('No se pudo completar. Inténtalo de nuevo.')
  })

  it('detecta el bloqueo de PIN del backend', () => {
    const locked = new ApiError(PIN_LOCKED_DETAIL, 401)
    expect(isPinLockedError(locked)).toBe(true)
    expect(isPinLockedError(new ApiError('credenciales inválidas', 401))).toBe(false)
    expect(isPinLockedError(new ApiError(PIN_LOCKED_DETAIL, 403))).toBe(false)
  })

  it('aclara el 502 invite_email_failed', () => {
    const error = toApiError(
      axiosError(502, {
        code: 'invite_email_failed',
        detail: 'smtp timeout',
      }),
    )
    expect(error.code).toBe('invite_email_failed')
    expect(error.message).toBe(
      'No se pudo enviar el correo de invitación; puedes reenviarla.',
    )
  })

  it('deja los 409 de bloqueo como mensaje, no como campo', () => {
    const blocked = toApiError(axiosError(409, { detail: 'el cliente ya está bloqueado' }))
    expect(blocked.fieldErrors).toEqual({})
    expect(blocked.message).toBe('el cliente ya está bloqueado')

    const unblocked = toApiError(axiosError(409, { detail: 'el cliente no está bloqueado' }))
    expect(unblocked.fieldErrors).toEqual({})
    expect(unblocked.message).toBe('el cliente no está bloqueado')
  })
})
