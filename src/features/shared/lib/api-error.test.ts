import axios from 'axios'
import { describe, expect, it } from 'vitest'

import {
  CBF_215_CEDULA_INVALID,
  CBF_215_DOCUMENT_EXISTS,
  CBF_215_GUARANTOR_DOCUMENT_DUPLICATE,
  CBF_215_PASSPORT_INVALID,
  CBF_215_RNC_INVALID,
  maxContactsMessage,
} from '@/test/fixtures'

import {
  ApiError,
  GENERIC_MESSAGE,
  isPinLockedError,
  LEADING_IDENTIFIER,
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
            msg: 'Cédula inválida',
            type: 'value_error',
          },
        ],
      }),
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error.fieldErrors.document).toBe('Cédula inválida')
    expect(error.message).toBe('Cédula inválida')
  })

  it('mapea 422 con field al campo, no al texto', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          {
            field: 'down_payment',
            code: 'value_error',
            message: 'La inicial debe ser menor que el precio',
          },
        ],
      }),
    )
    expect(error.code).toBe('value_error')
    expect(error.fieldErrors.down_payment).toBe('La inicial debe ser menor que el precio')
    expect(error.message).toBe('La inicial debe ser menor que el precio')
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

  it('mapea códigos de anulación y contrato de 207', () => {
    expect(
      toApiError(
        axiosError(409, {
          detail: [{ field: null, code: 'SALE_HAS_PAYMENTS', message: 'no se puede anular' }],
        }),
      ).message,
    ).toBe('No se puede anular: la venta ya tiene pagos.')
    expect(
      toApiError(
        axiosError(409, {
          detail: [{ field: null, code: 'SALE_ALREADY_VOIDED', message: 'ya anulada' }],
        }),
      ).message,
    ).toBe('Esta venta ya estaba anulada.')
    expect(
      toApiError(
        axiosError(409, {
          detail: [
            { field: null, code: 'LEGACY_SALE_LEGAL_DATA_MISSING', message: 'sin rnc' },
          ],
        }),
      ).message,
    ).toBe('Esta venta se registró sin RNC ni dirección del negocio.')
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
      axiosError(422, {
        detail: [{ field: null, code: 'value_error', message: maxContactsMessage() }],
      }),
    )
    expect(contacts.message).toBe(maxContactsMessage())
    expect(contacts.code).toBe('value_error')
    expect(contacts.status).toBe(422)

    const plain409 = toApiError(
      axiosError(
        409,
        {
          detail: 'Ya existe un cliente con este documento',
        },
        '/clients',
      ),
    )
    expect(plain409.fieldErrors.document).toBe('Ya existe un cliente con este documento')
    expect(plain409.code).toBeUndefined()
    expect(plain409.message).toBe('Ya existe un cliente con este documento')
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
    expect(error.message).toBe(GENERIC_MESSAGE)
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
      axiosError(409, { detail: 'El cliente ya está bloqueado' }, '/clients/cli-1/block'),
    )
    expect(blocked.fieldErrors).toEqual({})
    expect(blocked.message).toBe('El cliente ya está bloqueado')

    const unblocked = toApiError(
      axiosError(409, { detail: 'El cliente no está bloqueado' }, '/clients/cli-1/unblock'),
    )
    expect(unblocked.fieldErrors).toEqual({})
    expect(unblocked.message).toBe('El cliente no está bloqueado')
  })

  it('un detail de lista en inglés se reemplaza por el genérico', () => {
    const required = toApiError(
      axiosError(422, {
        detail: [{ loc: ['body', 'price'], msg: 'Field required', type: 'missing' }],
      }),
    )
    expect(required.message).toBe(GENERIC_MESSAGE)
    expect(required.fieldErrors).toEqual({})

    const decode = toApiError(
      axiosError(422, {
        detail: [{ loc: ['body'], msg: 'JSON decode error', type: 'json_invalid' }],
      }),
    )
    expect(decode.message).toBe(GENERIC_MESSAGE)
    expect(decode.fieldErrors).toEqual({})

    const spanish = toApiError(
      axiosError(422, {
        detail: [{ field: 'price', msg: 'El precio es obligatorio' }],
      }),
    )
    expect(spanish.message).toBe('El precio es obligatorio')
    expect(spanish.fieldErrors.price).toBe('El precio es obligatorio')

    const blocked = toApiError(axiosError(409, { detail: 'Atraso de 3 cuotas' }))
    expect(blocked.message).toBe('Atraso de 3 cuotas')
  })

  it('No permission no se trata como español', () => {
    const error = toApiError(axiosError(403, { detail: 'No permission' }))
    expect(error.message).toBe(GENERIC_MESSAGE)
    expect(error.message).not.toBe('No permission')
  })

  it('un 409 de PATCH /clients/:id sin código no va a document', () => {
    const general = toApiError(
      axiosError(409, { detail: 'Este cliente ya está en otro negocio' }, '/clients/cli-1'),
    )
    expect(general.fieldErrors).toEqual({})
    expect(general.message).toBe('Este cliente ya está en otro negocio')

    const duplicate = toApiError(
      axiosError(
        409,
        { detail: 'Ya existe un cliente con este documento', code: 'DOCUMENT_DUPLICATE' },
        '/clients/cli-1',
      ),
    )
    expect(duplicate.fieldErrors.document).toBe('Ya existe un cliente con este documento')
    expect(duplicate.code).toBe('DOCUMENT_DUPLICATE')
  })

  it('un 409 de garante no va al campo document', () => {
    const guarantor = toApiError(
      axiosError(
        409,
        { detail: 'El documento del garante no se pudo leer' },
        '/clients/cli-1/contacts',
      ),
    )
    expect(guarantor.fieldErrors).toEqual({})
    expect(guarantor.message).toBe('El documento del garante no se pudo leer')
  })
})

const BACKEND_A_SPANISH_MESSAGES = [
  'Campo obligatorio',
  'Campos adicionales no permitidos',
  'Debe ser texto',
  'Debe tener al menos 1 carácter',
  'Debe tener como máximo 500 caracteres',
  'Debe ser un número entero',
  'Debe ser verdadero o falso',
  'Identificador inválido',
  'Valor no permitido',
  'Fecha inválida (usa AAAA-MM-DD)',
  'Fecha y hora inválidas',
  'Debe ser mayor o igual a 1',
  'Debe ser menor o igual a 10',
  'Debe ser mayor que 0',
  'Debe ser menor que 100',
  'Debe ser una lista',
  'Debe tener al menos 1 elemento',
  'Debe tener como máximo 50 elementos',
  'El cuerpo debe ser un objeto',
  'El cuerpo no es un JSON válido',
  'Email inválido',
  'Dato inválido',
  'Debe ser un número',
  'Monto inválido',
  'RNC inválido',
] as const

describe('contrato 210-A {field, code, message}', () => {
  it('un 422 con varios items llena fieldErrors y el mensaje es el del primero', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          { field: 'price', code: 'value_error', message: 'El precio debe ser mayor que cero' },
          { field: 'installments', code: 'int_type', message: 'Debe ser un número entero' },
        ],
      }),
    )
    expect(error.fieldErrors.price).toBe('El precio debe ser mayor que cero')
    expect(error.fieldErrors.installments).toBe('Debe ser un número entero')
    expect(error.message).toBe('El precio debe ser mayor que cero')
    expect(error.code).toBe('value_error')
    expect(error.codes).toEqual(['value_error', 'int_type'])
  })

  it('un item con field null va al mensaje, no a un campo', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [{ field: null, code: 'value_error', message: 'El monto supera el máximo' }],
      }),
    )
    expect(error.fieldErrors).toEqual({})
    expect(error.message).toBe('El monto supera el máximo')
    expect(error.code).toBe('value_error')
  })

  it('un 422 de bitácora llena fieldErrors.from y fieldErrors.to', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          { field: 'from', code: 'value_error', message: 'from y to deben incluir zona horaria' },
          { field: 'to', code: 'value_error', message: 'from y to deben incluir zona horaria' },
        ],
      }),
    )
    expect(error.fieldErrors.from).toBe('from y to deben incluir zona horaria')
    expect(error.fieldErrors.to).toBe('from y to deben incluir zona horaria')
    expect(error.message).toBe('from y to deben incluir zona horaria')
    expect(error.code).toBe('value_error')
  })

  it('acepta Idempotency-Key como field con value_error', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          {
            field: 'Idempotency-Key',
            code: 'value_error',
            message: 'Idempotency-Key: identificador inválido',
          },
        ],
      }),
    )
    expect(error.fieldErrors['Idempotency-Key']).toBe('Idempotency-Key: identificador inválido')
    expect(error.code).toBe('value_error')
    expect(error.message).toBe('Idempotency-Key: identificador inválido')
    expect(error.message).not.toBe(GENERIC_MESSAGE)
  })

  it('un UUID inválido en simulate/create usa value_error y client_id: identificador inválido', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          {
            field: 'client_id',
            code: 'value_error',
            message: 'client_id: identificador inválido',
          },
        ],
      }),
    )
    expect(error.fieldErrors.client_id).toBe('client_id: identificador inválido')
    expect(error.code).toBe('value_error')
    expect(error.message).toBe('client_id: identificador inválido')
    expect(error.message).not.toBe(GENERIC_MESSAGE)
  })

  it('un precio por encima del máximo usa field price y code amount', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [{ field: 'price', code: 'amount', message: 'El monto supera el máximo' }],
      }),
    )
    expect(error.fieldErrors.price).toBe('El monto supera el máximo')
    expect(error.code).toBe('amount')
    expect(error.message).toBe('El monto supera el máximo')
    expect(error.message).not.toBe(GENERIC_MESSAGE)
  })

  it('un UUID inválido de collector_membership_id usa uuid_parsing y se muestra tal cual', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          {
            field: 'collector_membership_id',
            code: 'uuid_parsing',
            message: 'collector_membership_id: identificador inválido',
          },
        ],
      }),
    )
    expect(error.fieldErrors.collector_membership_id).toBe(
      'collector_membership_id: identificador inválido',
    )
    expect(error.code).toBe('uuid_parsing')
    expect(error.message).toBe('collector_membership_id: identificador inválido')
    expect(error.message).not.toBe(GENERIC_MESSAGE)
  })

  it('lee los 6 códigos 409 nuevos con el mensaje del backend', () => {
    const cases = [
      ['CLIENT_ALREADY_BLOCKED', 'El cliente ya está bloqueado'],
      ['CLIENT_NOT_BLOCKED', 'El cliente no está bloqueado'],
      ['CLIENT_DOCUMENT_EXISTS', 'Ya existe un cliente con este documento'],
      ['LAST_ACTIVE_OWNER', 'El negocio debe tener al menos un dueño activo'],
      ['INVITATION_ACCEPT_CONFLICT', 'No se pudo completar la invitación'],
      ['INVITATION_NOT_REVOCABLE', 'La invitación no se puede revocar'],
    ] as const

    for (const [code, message] of cases) {
      const error = toApiError(
        axiosError(409, { detail: [{ field: null, code, message }] }, '/users/mem-1'),
      )
      expect(error.code).toBe(code)
      expect(error.message).toBe(message)
    }
  })

  it('CLIENT_DOCUMENT_EXISTS llena fieldErrors.document', () => {
    const error = toApiError(
      axiosError(
        409,
        {
          detail: [
            {
              field: null,
              code: 'CLIENT_DOCUMENT_EXISTS',
              message: 'Ya existe un cliente con este documento',
            },
          ],
        },
        '/clients',
      ),
    )
    expect(error.fieldErrors.document).toBe('Ya existe un cliente con este documento')
    expect(error.code).toBe('CLIENT_DOCUMENT_EXISTS')
  })

  it('CLIENT_ALREADY_BLOCKED en /clients/{id}/block no llena document', () => {
    const error = toApiError(
      axiosError(
        409,
        {
          detail: [
            {
              field: null,
              code: 'CLIENT_ALREADY_BLOCKED',
              message: 'El cliente ya está bloqueado',
            },
          ],
        },
        '/clients/cli-1/block',
      ),
    )
    expect(error.fieldErrors).toEqual({})
    expect(error.fieldErrors.document).toBeUndefined()
    expect(error.message).toBe('El cliente ya está bloqueado')
    expect(error.code).toBe('CLIENT_ALREADY_BLOCKED')
  })

  it('los códigos existentes siguen usando messageForCode', () => {
    expect(
      toApiError(
        axiosError(409, {
          detail: [{ field: null, code: 'DOCUMENT_UNREADABLE', message: 'crypto' }],
        }),
      ).message,
    ).toBe(
      'No pudimos leer el documento del cliente. Revisa la ficha y vuelve a guardar el documento. Si sigue pasando, avísanos.',
    )
    expect(
      toApiError(
        axiosError(409, {
          detail: [{ field: null, code: 'SALE_HAS_PAYMENTS', message: 'no se puede anular' }],
        }),
      ).message,
    ).toBe('No se puede anular: la venta ya tiene pagos.')
  })

  it('la forma vieja string, loc/msg/type y el dict 502 siguen funcionando', () => {
    const string409 = toApiError(
      axiosError(409, { detail: 'Ya existe un cliente con este documento' }, '/clients'),
    )
    expect(string409.fieldErrors.document).toBe('Ya existe un cliente con este documento')
    expect(string409.code).toBeUndefined()

    const locType = toApiError(
      axiosError(422, {
        detail: [
          {
            loc: ['body', 'document'],
            msg: 'Cédula inválida',
            type: 'value_error',
          },
        ],
      }),
    )
    expect(locType.fieldErrors.document).toBe('Cédula inválida')
    expect(locType.message).toBe('Cédula inválida')

    const invite502 = toApiError(
      axiosError(502, { detail: { code: 'invite_email_failed', message: 'smtp timeout' } }),
    )
    expect(invite502.code).toBe('invite_email_failed')
    expect(invite502.message).toBe(
      'No se pudo enviar el correo de invitación; puedes reenviarla.',
    )
  })

  it('un message en inglés en la forma nueva cae al genérico', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [{ field: 'price', code: 'missing', message: 'Field required' }],
      }),
    )
    expect(error.message).toBe(GENERIC_MESSAGE)
    expect(error.fieldErrors).toEqual({})
    expect(error.code).toBe('missing')
  })

  it('si hay items nuevos y viejos, gana el contrato nuevo', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          { loc: ['body', 'price'], msg: 'Field required', type: 'missing' },
          { field: 'down_payment', code: 'value_error', message: 'La inicial debe ser menor que el precio' },
        ],
      }),
    )
    expect(error.code).toBe('value_error')
    expect(error.message).toBe('La inicial debe ser menor que el precio')
    expect(error.fieldErrors.down_payment).toBe('La inicial debe ser menor que el precio')
    expect(error.fieldErrors.price).toBeUndefined()
  })

  it('Campos adicionales no permitidos va al campo y no al genérico', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          {
            field: 'status',
            code: 'extra_forbidden',
            message: 'Campos adicionales no permitidos',
          },
        ],
      }),
    )
    expect(error.fieldErrors.status).toBe('Campos adicionales no permitidos')
    expect(error.message).toBe('Campos adicionales no permitidos')
    expect(error.message).not.toBe(GENERIC_MESSAGE)
    expect(error.code).toBe('extra_forbidden')
  })

  it.each(BACKEND_A_SPANISH_MESSAGES)(
    'el mensaje en español %s no cae en GENERIC_MESSAGE',
    (message) => {
      const error = toApiError(
        axiosError(422, {
          detail: [{ field: 'status', code: 'value_error', message }],
        }),
      )
      expect(error.message).toBe(message)
      expect(error.message).not.toBe(GENERIC_MESSAGE)
      expect(error.fieldErrors.status).toBe(message)
    },
  )

  it.each([
    ['Indica al menos una frecuencia', 'no'],
    ['demasiado largo', 'no'],
    ['no puede ser negativa', 'no'],
    ['no admite recargo', 'no'],
    ['monto inválido', 'no'],
    ['nombre obligatorio', 'no'],
    ['Field required', 'sí'],
    ['too long', 'sí'],
    ['Invalid input', 'sí'],
    ['Value must not be negative', 'sí'],
    ['Extra inputs are not permitted', 'sí'],
  ] as const)(
    'el detalle viejo "%s" %s cae en GENERIC_MESSAGE',
    (message, falls) => {
      const error = toApiError(
        axiosError(422, {
          detail: [{ field: 'status', code: 'value_error', message }],
        }),
      )
      if (falls === 'sí') {
        expect(error.message).toBe(GENERIC_MESSAGE)
        expect(error.fieldErrors).toEqual({})
      } else {
        expect(error.message).toBe(message)
        expect(error.message).not.toBe(GENERIC_MESSAGE)
        expect(error.fieldErrors.status).toBe(message)
      }
    },
  )

  it('un 409 string en inglés en POST /clients no va a document', () => {
    const error = toApiError(
      axiosError(409, { detail: 'Duplicate key value violates unique constraint' }, '/clients'),
    )
    expect(error.message).toBe(GENERIC_MESSAGE)
    expect(error.fieldErrors).toEqual({})
    expect(error.fieldErrors.document).toBeUndefined()
  })

  it('CLIENT_ALREADY_BLOCKED en /clients no llena document (P6: el return del contrato nuevo)', () => {
    const error = toApiError(
      axiosError(
        409,
        {
          detail: [
            {
              field: null,
              code: 'CLIENT_ALREADY_BLOCKED',
              message: 'El cliente ya está bloqueado',
            },
          ],
        },
        '/clients',
      ),
    )
    expect(error.code).toBe('CLIENT_ALREADY_BLOCKED')
    expect(error.fieldErrors).toEqual({})
    expect(error.fieldErrors.document).toBeUndefined()
    expect(error.message).toBe('El cliente ya está bloqueado')
  })

  it('el fallback de document en 409 usa mayúscula inicial (N14)', () => {
    const error = toApiError(axiosError(409, { detail: '' }, '/clients'))
    expect(error.fieldErrors.document).toBe('Ya existe un cliente con este documento')
    expect(error.message).toBe('Ya existe un cliente con este documento')
  })

  it('una palabra en inglés con prefijo español cae en GENERIC_MESSAGE (F7)', () => {
    const error = toApiError(axiosError(422, { detail: 'Parameter is required' }))
    expect(error.message).toBe(GENERIC_MESSAGE)
    expect(error.message).not.toBe('Parameter is required')
  })

  it('anchor_date no puede ser posterior a hoy se muestra tal cual', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          {
            field: 'anchor_date',
            code: 'value_error',
            message: 'anchor_date no puede ser posterior a hoy',
          },
        ],
      }),
    )
    expect(error.message).toBe('anchor_date no puede ser posterior a hoy')
    expect(error.message).not.toBe(GENERIC_MESSAGE)
    expect(error.fieldErrors.anchor_date).toBe('anchor_date no puede ser posterior a hoy')
  })

  it.each(['name no puede ser null', 'phone no puede ser null'] as const)(
    '"%s" se muestra tal cual y no cae en el genérico',
    (message) => {
      const error = toApiError(
        axiosError(422, {
          detail: [{ field: 'name', code: 'value_error', message }],
        }),
      )
      expect(error.message).toBe(message)
      expect(error.message).not.toBe(GENERIC_MESSAGE)
    },
  )

  it.each([
    'Idempotency-Key: identificador inválido',
    'client_id: identificador inválido',
  ] as const)('"%s" se muestra tal cual (prefijo con : recortado, resto español)', (message) => {
    const error = toApiError(
      axiosError(422, {
        detail: [{ field: null, code: 'value_error', message }],
      }),
    )
    expect(error.message).toBe(message)
    expect(error.message).not.toBe(GENERIC_MESSAGE)
  })

  it('LEADING_IDENTIFIER solo ancla al inicio (B5)', () => {
    expect(LEADING_IDENTIFIER.test('client_id is required')).toBe(true)
    expect(LEADING_IDENTIFIER.test('value_error')).toBe(true)
    expect(LEADING_IDENTIFIER.test('Idempotency-Key: identificador inválido')).toBe(true)
    expect(LEADING_IDENTIFIER.test('client_id: identificador inválido')).toBe(true)
    expect(LEADING_IDENTIFIER.test('see value_error')).toBe(false)
    expect(LEADING_IDENTIFIER.test('see client_id is required')).toBe(false)
    expect(LEADING_IDENTIFIER.test('see Idempotency-Key: identificador inválido')).toBe(false)
    expect(LEADING_IDENTIFIER.test('see client_id: identificador inválido')).toBe(false)
    expect(LEADING_IDENTIFIER.test('anchor_date must not be in the future')).toBe(true)
    expect(LEADING_IDENTIFIER.test('see anchor_date must not be in the future')).toBe(false)
  })

  it.each([
    ['value_error', 'sí'],
    ['client_id is required', 'sí'],
    ['anchor_date must not be in the future', 'sí'],
    ['uq_clients_document violates unique constraint', 'sí'],
    ['from debe ser anterior a to', 'no'],
    ['from y to deben incluir zona horaria', 'no'],
    ['From y to deben incluir zona horaria', 'no'],
    ['anchor_date no puede ser posterior a hoy', 'no'],
    ['anchor_date y anchor_offset van juntos', 'no'],
    ['client_id debe ser un UUID', 'no'],
    ['Identificador inválido', 'no'],
    ['Idempotency-Key: identificador inválido', 'no'],
    ['client_id: identificador inválido', 'no'],
    ['Idempotency-Key: must be a UUID', 'sí'],
    ['client_id: invalid uuid', 'sí'],
    ['Monto: invalid amount', 'sí'],
    ['Nombre: required', 'sí'],
  ] as const)('el detalle con identificador "%s" %s cae en GENERIC_MESSAGE', (message, falls) => {
    const error = toApiError(
      axiosError(422, {
        detail: [{ field: null, code: 'value_error', message }],
      }),
    )
    if (falls === 'sí') {
      expect(error.message).toBe(GENERIC_MESSAGE)
      expect(error.fieldErrors).toEqual({})
    } else {
      expect(error.message).toBe(message)
      expect(error.message).not.toBe(GENERIC_MESSAGE)
    }
  })

  it.each([
    'Dato invalido',
    'Campos obligatorios',
    'Campo obligatorio',
    'Fecha invalida',
    'Monto invalido',
    'Identificador invalido',
  ] as const)('la variante sin tilde o en plural %s se reconoce como español', (message) => {
    const error = toApiError(
      axiosError(422, {
        detail: [{ field: 'status', code: 'value_error', message }],
      }),
    )
    expect(error.message).toBe(message)
    expect(error.message).not.toBe(GENERIC_MESSAGE)
    expect(error.fieldErrors.status).toBe(message)
  })

  it.each(['Invalid input', 'Field required', 'negative', 'permitted'] as const)(
    'el inglés %s sigue cayendo en GENERIC_MESSAGE',
    (message) => {
      const error = toApiError(
        axiosError(422, {
          detail: [{ field: 'status', code: 'value_error', message }],
        }),
      )
      expect(error.message).toBe(GENERIC_MESSAGE)
      expect(error.fieldErrors).toEqual({})
    },
  )
})

describe('CBF-215 field de documento', () => {
  it('un 422 con field document va al campo, no por el status', () => {
    for (const item of [CBF_215_CEDULA_INVALID, CBF_215_PASSPORT_INVALID, CBF_215_RNC_INVALID]) {
      const error = toApiError(axiosError(422, { detail: [item] }))
      expect(error.status).toBe(422)
      expect(error.code).toBe(item.code)
      expect(error.fieldErrors.document).toBe(item.message)
      expect(error.message).toBe(item.message)
    }
  })

  it('un 422 con field guarantors.1.document va a esa clave', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [
          CBF_215_CEDULA_INVALID,
          {
            field: 'guarantors.1.document',
            code: 'value_error',
            message: CBF_215_CEDULA_INVALID.message,
          },
        ],
      }),
    )
    expect(error.fieldErrors.document).toBe(CBF_215_CEDULA_INVALID.message)
    expect(error.fieldErrors['guarantors.1.document']).toBe(CBF_215_CEDULA_INVALID.message)
  })

  it('un 409 con field document usa CLIENT_DOCUMENT_EXISTS y el message del backend', () => {
    const error = toApiError(axiosError(409, { detail: [CBF_215_DOCUMENT_EXISTS] }, '/clients'))
    expect(error.status).toBe(409)
    expect(error.code).toBe(CBF_215_DOCUMENT_EXISTS.code)
    expect(error.fieldErrors.document).toBe(CBF_215_DOCUMENT_EXISTS.message)
    expect(error.message).toBe(CBF_215_DOCUMENT_EXISTS.message)
  })

  it('un garante duplicado con field guarantors.0.document va a ese input', () => {
    const error = toApiError(
      axiosError(409, { detail: [CBF_215_GUARANTOR_DOCUMENT_DUPLICATE] }, '/clients'),
    )
    expect(error.code).toBe(CBF_215_GUARANTOR_DOCUMENT_DUPLICATE.code)
    expect(error.fieldErrors['guarantors.0.document']).toBe(
      CBF_215_GUARANTOR_DOCUMENT_DUPLICATE.message,
    )
    expect(error.fieldErrors.document).toBeUndefined()
  })

  it('un error de documento con field null sigue sin fieldErrors (banner)', () => {
    const error = toApiError(
      axiosError(422, {
        detail: [{ field: null, code: 'value_error', message: 'Cédula inválida' }],
      }),
    )
    expect(error.fieldErrors).toEqual({})
    expect(error.message).toBe('Cédula inválida')
  })
})
