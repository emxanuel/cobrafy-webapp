import { beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { getFieldErrors, isApiError } from '@/features/shared/lib/api-error'
import { http, HttpResponse } from 'msw'

import { authResponse, businesses, membership, users } from '@/test/fixtures'
import { searchRequests } from '@/test/handlers'
import { server } from '@/test/server'
import { createClient, createClientWithContacts, searchClients } from './requests'

describe('client requests', () => {
  beforeEach(() => {
    useSessionStore.getState().applyAuth(
      authResponse({
        user: users.cashier,
        memberships: [membership(users.cashier, businesses.norte, 'cajero')],
        token: 'token-cashier',
      }),
    )
    useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
  })

  it('expone el 422 en document', async () => {
    try {
      await createClient({
        name: 'Ana Pérez',
        doc_type: 'cedula',
        document: 'malo',
        phone: '8095551111',
        address: 'Calle 1',
      })
      throw new Error('debía fallar')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(getFieldErrors(error).document).toBe('El formato de la cédula no es válido.')
    }
  })

  it('expone el 409 en document con el mensaje del backend', async () => {
    try {
      await createClient({
        name: 'Ana Pérez',
        doc_type: 'cedula',
        document: 'duplicado',
        phone: '8095551111',
        address: 'Calle 1',
      })
      throw new Error('debía fallar')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(getFieldErrors(error).document).toBe('ya existe un cliente con este documento')
    }
  })

  it('POST /clients/search manda q, page y page_size; no query', async () => {
    await searchClients({ q: 'Ana', page: 1, page_size: 50 })
    expect(searchRequests.at(-1)?.body).toEqual({
      q: 'Ana',
      page: 1,
      page_size: 50,
    })
    expect(searchRequests.at(-1)?.url).not.toContain('Ana')
  })

  it('si falla un contacto no reintenta el alta del cliente', async () => {
    server.use(
      http.post('*/clients/:id/contacts', () =>
        HttpResponse.json({ detail: 'no se pudo guardar' }, { status: 500 }),
      ),
    )
    const result = await createClientWithContacts(
      {
        name: 'Ana Pérez',
        doc_type: 'cedula',
        document: '001-1234567-8',
        phone: '8095551111',
        address: 'Calle 1',
      },
      [
        {
          type: 'garante',
          name: 'Pedro Gómez',
          phone: '8095552222',
          relationship: 'Hermano',
        },
      ],
    )
    expect(result.client.id).toMatch(/^cli-new-/)
    expect(result.failedContacts).toBe(1)
    expect(result.failedContactNames).toEqual(['Pedro Gómez'])
    expect(result.client.name).toBe('Ana Pérez')
  })
})
