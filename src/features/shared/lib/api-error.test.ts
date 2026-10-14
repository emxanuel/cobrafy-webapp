import axios from 'axios'
import { describe, expect, it } from 'vitest'

import { ApiError, toApiError } from './api-error'

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
  it('mapea 422 de FastAPI al campo', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          {
            loc: ['body', 'document_number'],
            msg: 'El formato de la cédula no es válido.',
            type: 'value_error',
          },
        ],
      }),
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error.fieldErrors.document_number).toBe('El formato de la cédula no es válido.')
  })

  it('mapea 409 de documento duplicado al campo', () => {
    const error = toApiError(
      axiosError(409, {
        detail: 'Ya existe un cliente con este documento',
      }),
    )
    expect(error.fieldErrors.document_number).toBe('Ya existe un cliente con este documento')
  })
})
