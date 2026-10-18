import axios from 'axios'
import { describe, expect, it } from 'vitest'

import {
  ApiError,
  GENERIC_MESSAGE,
  isPinLockedError,
  PIN_LOCKED_DETAIL,
  toApiError,
} from './api-error'

function axiosError(status: number, data: unknown, url = '') {
  return new axios.AxiosError(
    'Request failed',
    String(status),
    { headers: new axios.AxiosHeaders(), url },
    undefined,
    {
      status,
      data,
      statusText: '',
      headers: {},
      config: { headers: new axios.AxiosHeaders(), url },
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
            message: 'Configura el crédito del negocio antes de vender',
          },
        ],
      }),
    )
    expect(error.code).toBe('CREDIT_SETTINGS_MISSING')
    expect(error.fieldErrors).toEqual({})
    expect(error.message).toBe('Configura el crédito del negocio antes de vender')
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

  it('un detail string en español se muestra tal cual', () => {
    const login401 = toApiError(axiosError(401, { detail: 'credenciales inválidas' }))
    expect(login401.message).toBe('credenciales inválidas')
    expect(login401.message).not.toBe('Tu sesión caducó. Entra de nuevo.')

    const invite = toApiError(axiosError(400, { detail: 'invitación inválida' }))
    expect(invite.message).toBe('invitación inválida')

    const contacts = toApiError(
      axiosError(409, { detail: 'el cliente ya tiene el máximo de 50 contactos' }),
    )
    expect(contacts.message).toBe('el cliente ya tiene el máximo de 50 contactos')

    const plain409 = toApiError(
      axiosError(
        409,
        {
          detail: 'ya existe un cliente con este documento',
        },
        '/clients',
      ),
    )
    expect(plain409.fieldErrors.document).toBe('ya existe un cliente con este documento')
    expect(plain409.code).toBeUndefined()
    expect(plain409.message).toBe('ya existe un cliente con este documento')
  })

  it('un detail técnico en inglés se reemplaza por el genérico', () => {
    const notFound = toApiError(axiosError(404, { detail: 'Not Found' }))
    expect(notFound.fieldErrors).toEqual({})
    expect(notFound.code).toBeUndefined()
    expect(notFound.message).toBe(GENERIC_MESSAGE)
    expect(notFound.message).not.toBe('Not Found')

    const method = toApiError(axiosError(405, { detail: 'Method Not Allowed' }))
    expect(method.message).toBe(GENERIC_MESSAGE)

    const duplicate = toApiError(
      axiosError(409, { detail: 'Duplicate key value violates unique constraint' }, '/sales'),
    )
    expect(duplicate.message).toBe(GENERIC_MESSAGE)
    expect(duplicate.fieldErrors).toEqual({})

    const serverError = toApiError(axiosError(500, { detail: 'se rompió el servidor' }))
    expect(serverError.message).toBe(GENERIC_MESSAGE)
  })

  it('un 409 con lista vacía usa el mensaje genérico', () => {
    const error = toApiError(axiosError(409, { detail: [] }))
    expect(error.code).toBeUndefined()
    expect(error.fieldErrors).toEqual({})
    expect(error.message).toBe(GENERIC_MESSAGE)
    expect(error.message).not.toBe('Ese dato ya está registrado.')
  })

  it('IDEMPOTENCY_KEY_REUSED conserva el código para el aviso de la hoja', () => {
    const error = toApiError(
      axiosError(409, {
        detail: [{ field: null, code: 'IDEMPOTENCY_KEY_REUSED', message: 'key reused' }],
      }),
    )
    expect(error.code).toBe('IDEMPOTENCY_KEY_REUSED')
    expect(error.message).toBe('key reused')
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

  it('deja los 409 de bloqueo como banner, no como campo', () => {
    const blocked = toApiError(
      axiosError(409, { detail: 'el cliente ya está bloqueado' }, '/clients/cli-1/block'),
    )
    expect(blocked.fieldErrors).toEqual({})
    expect(blocked.message).toBe('el cliente ya está bloqueado')

    const unblocked = toApiError(
      axiosError(409, { detail: 'el cliente no está bloqueado' }, '/clients/cli-1/unblock'),
    )
    expect(unblocked.fieldErrors).toEqual({})
    expect(unblocked.message).toBe('el cliente no está bloqueado')
  })

  it('un 409 de garante no va al campo document', () => {
    const guarantor = toApiError(
      axiosError(
        409,
        { detail: 'el documento del garante no se pudo leer' },
        '/clients/cli-1/contacts',
      ),
    )
    expect(guarantor.fieldErrors).toEqual({})
    expect(guarantor.message).toBe('el documento del garante no se pudo leer')
  })
})
