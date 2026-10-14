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

  it('mapea 409 de documento duplicado al campo document', () => {
    const error = toApiError(
      axiosError(409, {
        detail: 'ya existe un cliente con este documento',
      }),
    )
    expect(error.fieldErrors.document).toBe('ya existe un cliente con este documento')
    expect(error.message).toBe('ya existe un cliente con este documento')
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
