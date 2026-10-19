import { beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { getFieldErrors, isApiError } from '@/features/shared/lib/api-error'
import { http, HttpResponse } from 'msw'

import {
  authResponse,
  businesses,
  CBF_215_CEDULA_INVALID,
  membership,
  users,
} from '@/test/fixtures'
import { clientWrites, contactWrites, searchRequests } from '@/test/handlers'
import { server } from '@/test/server'
import {
  createClient,
  createClientWithContacts,
  createContact,
  getClient,
  saveContactsDiff,
  searchClients,
  updateClient,
  updateClientWithContacts,
} from './requests'

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

  it('expone el 422 de cédula en el mensaje (field null → banner)', async () => {
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
      expect(getFieldErrors(error)).toEqual({})
      expect((error as Error).message).toBe('Cédula inválida')
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
      expect(getFieldErrors(error).document).toBe('Ya existe un cliente con este documento')
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
    expect(result.failed).toEqual([{ name: 'Pedro Gómez', op: 'add' }])
    expect(result.client.name).toBe('Ana Pérez')
  })

  it('POST /clients/:id/contacts 422 field document se remapea al contacto que llamó', async () => {
    let creates = 0
    server.use(
      http.post('*/clients/:id/contacts', () => {
        creates += 1
        if (creates === 2) {
          return HttpResponse.json({ detail: [CBF_215_CEDULA_INVALID] }, { status: 422 })
        }
        return HttpResponse.json(
          {
            id: `ct-${creates}`,
            client_id: 'cli-x',
            type: 'garante',
            name: `Garante ${creates}`,
            phone: '8095552222',
            relationship: 'Hermano',
            address: null,
            doc_type: 'cedula',
            document: '001-2222222-2',
            has_document: true,
            document_available: true,
            is_active: true,
          },
          { status: 201 },
        )
      }),
    )
    try {
      await createClientWithContacts(
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
            name: 'Garante 1',
            phone: '8095552222',
            relationship: 'Hermano',
            document: '001-2222222-2',
          },
          {
            type: 'garante',
            name: 'Garante 2',
            phone: '8095553333',
            relationship: 'Primo',
            document: '001-3333333-3',
          },
        ],
      )
      throw new Error('debía fallar')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(getFieldErrors(error)['contacts.1.document']).toBe(CBF_215_CEDULA_INVALID.message)
      expect(getFieldErrors(error).document).toBeUndefined()
    }
  })

  it('al editar solo el teléfono el PATCH no manda document, address ni doc_type', async () => {
    const created = await createClient({
      name: 'Ana Pérez',
      doc_type: 'cedula',
      document: '001-1234567-8',
      phone: '8095551111',
      address: 'Calle 1',
    })
    const saved = await createContact(created.id, {
      type: 'referencia',
      name: 'Ref Uno',
      phone: '8095550001',
      relationship: 'Prima',
      address: 'Calle 9',
      doc_type: 'cedula',
      document: '001-9999999-9',
    })
    contactWrites.length = 0
    const notice = await saveContactsDiff(created.id, [saved], [
      {
        id: saved.id,
        type: saved.type,
        name: saved.name,
        phone: '8095559999',
        relationship: saved.relationship,
        address: saved.address,
        doc_type: saved.doc_type,
        document: saved.document,
      },
    ])
    expect(notice.failed).toEqual([])
    const patch = contactWrites.find((item) => item.method === 'PATCH')
    expect(patch?.body).toEqual({ phone: '8095559999' })
    expect(patch?.body).not.toHaveProperty('document')
    expect(patch?.body).not.toHaveProperty('address')
    expect(patch?.body).not.toHaveProperty('doc_type')
  })

  it('el diff de contactos manda POST, PATCH y DELETE', async () => {
    const created = await createClient({
      name: 'Ana Pérez',
      doc_type: 'cedula',
      document: '001-1234567-8',
      phone: '8095551111',
      address: 'Calle 1',
    })
    await createContact(created.id, {
      type: 'referencia',
      name: 'Ref Uno',
      phone: '8095550001',
      relationship: 'Prima',
    })
    await createContact(created.id, {
      type: 'garante',
      name: 'Garante Viejo',
      phone: '8095550002',
      relationship: 'Tío',
    })
    const client = await getClient(created.id)
    const referencia = client.contacts.find((item) => item.type === 'referencia')
    expect(referencia).toBeTruthy()
    contactWrites.length = 0

    const notice = await saveContactsDiff(created.id, client.contacts, [
      {
        id: referencia!.id,
        type: 'referencia',
        name: 'Ref Nueva',
        phone: '8095550001',
        relationship: 'Prima',
      },
      {
        type: 'garante',
        name: 'Garante Nuevo',
        phone: '8095550003',
        relationship: 'Hermano',
      },
    ])

    expect(notice.failed).toEqual([])
    const methods = contactWrites.map((item) => item.method)
    expect(methods.indexOf('DELETE')).toBeLessThan(methods.indexOf('PATCH'))
    expect(methods.indexOf('PATCH')).toBeLessThan(methods.indexOf('POST'))
    expect(
      contactWrites.some(
        (item) => item.method === 'PATCH' && (item.body as { name?: string }).name === 'Ref Nueva',
      ),
    ).toBe(true)
    expect(
      contactWrites.some(
        (item) =>
          item.method === 'POST' && (item.body as { name?: string }).name === 'Garante Nuevo',
      ),
    ).toBe(true)
  })

  it('con 50 contactos reemplaza uno haciendo DELETE antes del POST', async () => {
    const created = await createClient({
      name: 'Ana Pérez',
      doc_type: 'cedula',
      document: '001-1234567-8',
      phone: '8095551111',
      address: 'Calle 1',
    })
    const previous = []
    for (let index = 0; index < 50; index += 1) {
      previous.push(
        await createContact(created.id, {
          type: 'referencia',
          name: `Contacto ${index}`,
          phone: '8095550001',
          relationship: 'Prima',
        }),
      )
    }
    contactWrites.length = 0
    const kept = previous.slice(0, 49).map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      phone: item.phone,
      relationship: item.relationship,
    }))
    const notice = await saveContactsDiff(created.id, previous, [
      ...kept,
      {
        type: 'garante',
        name: 'Nuevo',
        phone: '8095557777',
        relationship: 'Hermano',
      },
    ])
    expect(notice.failed).toEqual([])
    const methods = contactWrites.map((item) => item.method)
    expect(methods[0]).toBe('DELETE')
    expect(methods.at(-1)).toBe('POST')
    expect(methods.filter((method) => method === 'POST')).toHaveLength(1)
    expect(methods.filter((method) => method === 'DELETE')).toHaveLength(1)
  })

  it('un id que ya no está activo no crea un duplicado', async () => {
    const created = await createClient({
      name: 'Ana Pérez',
      doc_type: 'cedula',
      document: '001-1234567-8',
      phone: '8095551111',
      address: 'Calle 1',
    })
    contactWrites.length = 0
    const notice = await saveContactsDiff(created.id, [], [
      {
        id: 'ct-desaparecido',
        type: 'referencia',
        name: 'Fantasma',
        phone: '8095550001',
        relationship: 'Prima',
      },
    ])
    expect(notice.failed).toEqual([{ name: 'Fantasma', op: 'edit' }])
    expect(contactWrites.some((item) => item.method === 'POST')).toBe(false)
  })

  it('un 401 corta el resto del diff', async () => {
    const created = await createClient({
      name: 'Ana Pérez',
      doc_type: 'cedula',
      document: '001-1234567-8',
      phone: '8095551111',
      address: 'Calle 1',
    })
    const first = await createContact(created.id, {
      type: 'referencia',
      name: 'Uno',
      phone: '8095550001',
      relationship: 'Prima',
    })
    const second = await createContact(created.id, {
      type: 'referencia',
      name: 'Dos',
      phone: '8095550002',
      relationship: 'Prima',
    })
    server.use(
      http.delete('*/clients/:id/contacts/:contactId', () =>
        HttpResponse.json({ detail: 'no autenticado' }, { status: 401 }),
      ),
    )
    contactWrites.length = 0
    const notice = await saveContactsDiff(created.id, [first, second], [])
    expect(notice.failed[0]).toEqual({ name: 'Uno', op: 'remove' })
    expect(notice.failed).toHaveLength(1)
    expect(notice.stoppedOnUnauthorized).toBe(true)
  })

  it('un 401 a mitad dice qué operaciones ya se aplicaron', async () => {
    const created = await createClient({
      name: 'Ana Pérez',
      doc_type: 'cedula',
      document: '001-1234567-8',
      phone: '8095551111',
      address: 'Calle 1',
    })
    const first = await createContact(created.id, {
      type: 'referencia',
      name: 'Uno',
      phone: '8095550001',
      relationship: 'Prima',
    })
    const second = await createContact(created.id, {
      type: 'referencia',
      name: 'Dos',
      phone: '8095550002',
      relationship: 'Prima',
    })
    let deletes = 0
    server.use(
      http.delete('*/clients/:id/contacts/:contactId', () => {
        deletes += 1
        if (deletes >= 2) {
          return HttpResponse.json({ detail: 'no autenticado' }, { status: 401 })
        }
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const notice = await saveContactsDiff(created.id, [first, second], [])
    expect(notice.applied).toEqual([{ name: 'Uno', op: 'remove' }])
    expect(notice.failed).toEqual([{ name: 'Dos', op: 'remove' }])
    expect(notice.stoppedOnUnauthorized).toBe(true)
  })

  it('no manda PATCH de un contacto que no cambió', async () => {
    const created = await createClient({
      name: 'Ana Pérez',
      doc_type: 'cedula',
      document: '001-1234567-8',
      phone: '8095551111',
      address: 'Calle 1',
    })
    const first = await createContact(created.id, {
      type: 'referencia',
      name: 'Uno',
      phone: '8095550001',
      relationship: 'Prima',
    })
    const second = await createContact(created.id, {
      type: 'referencia',
      name: 'Dos',
      phone: '8095550002',
      relationship: 'Prima',
    })
    contactWrites.length = 0
    await saveContactsDiff(created.id, [first, second], [
      {
        id: first.id,
        type: first.type,
        name: first.name,
        phone: first.phone,
        relationship: first.relationship,
      },
      {
        id: second.id,
        type: second.type,
        name: 'Dos editado',
        phone: second.phone,
        relationship: second.relationship,
      },
    ])
    const patches = contactWrites.filter((item) => item.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0]?.body).toEqual({ name: 'Dos editado' })
  })

  it('al borrar address y document el PATCH del contacto manda null', async () => {
    const created = await createClient({
      name: 'Ana Pérez',
      doc_type: 'cedula',
      document: '001-1234567-8',
      phone: '8095551111',
      address: 'Calle 1',
    })
    const saved = await createContact(created.id, {
      type: 'referencia',
      name: 'Ref Uno',
      phone: '8095550001',
      relationship: 'Prima',
      address: 'Calle 9',
      doc_type: 'cedula',
      document: '001-9999999-9',
    })
    contactWrites.length = 0
    await saveContactsDiff(created.id, [saved], [
      {
        id: saved.id,
        type: saved.type,
        name: saved.name,
        phone: saved.phone,
        relationship: saved.relationship,
        address: '',
        doc_type: saved.doc_type,
        document: '',
      },
    ])
    const patch = contactWrites.find((item) => item.method === 'PATCH')
    expect(patch?.body).toEqual({ address: null, document: null })
  })

  it('PATCH /clients/:id 409 de texto plano (forma vieja) no va a document', async () => {
    server.use(
      http.patch('*/clients/:id', () =>
        HttpResponse.json({ detail: 'Este cliente ya está en otro negocio' }, { status: 409 }),
      ),
    )
    try {
      await updateClient('cli-1', { phone: '8095550000' })
      throw new Error('debía fallar')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(getFieldErrors(error)).toEqual({})
      expect((error as Error).message).toBe('Este cliente ya está en otro negocio')
    }
  })

  it('PATCH /clients/:id 409 CLIENT_DOCUMENT_EXISTS (forma nueva) va a document', async () => {
    server.use(
      http.patch('*/clients/:id', () =>
        HttpResponse.json(
          {
            detail: [
              {
                field: null,
                code: 'CLIENT_DOCUMENT_EXISTS',
                message: 'Ya existe un cliente con este documento',
              },
            ],
          },
          { status: 409 },
        ),
      ),
    )
    try {
      await updateClient('cli-1', { document: '001-0000000-0' })
      throw new Error('debía fallar')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(getFieldErrors(error).document).toBe('Ya existe un cliente con este documento')
    }
  })

  it('al editar solo el teléfono del cliente el PATCH no manda document', async () => {
    const created = await createClient({
      name: 'Ana Pérez',
      doc_type: 'cedula',
      document: '001-1234567-8',
      phone: '8095551111',
      address: 'Calle 1',
    })
    clientWrites.length = 0
    await updateClientWithContacts(
      created.id,
      {
        name: 'Ana Pérez',
        doc_type: 'cedula',
        document: '001-1234567-8',
        phone: '8095559999',
        address: 'Calle 1',
      },
      [],
      [],
      created,
    )
    expect(clientWrites).toHaveLength(1)
    expect(clientWrites[0]?.body).toEqual({ phone: '8095559999' })
    expect(clientWrites[0]?.body).not.toHaveProperty('document')
    expect(clientWrites[0]?.body).not.toHaveProperty('address')
    expect(clientWrites[0]?.body).not.toHaveProperty('doc_type')
  })
})
