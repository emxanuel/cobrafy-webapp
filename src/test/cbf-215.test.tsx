import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { useBusinessStore } from '@/features/business/stores/business-store'
import type { ContactRead } from '@/features/clients/services/types'
import {
  CBF_215_CEDULA_INVALID,
  CBF_215_DOCUMENT_EXISTS,
  CBF_215_PASSPORT_INVALID,
  businesses,
  clientFixture,
  membership,
  users,
} from './fixtures'
import { renderApp, seedAuth } from './render'
import { server } from './server'

function loginCashier() {
  seedAuth({
    user: users.cashier,
    memberships: [membership(users.cashier, businesses.norte, 'cajero')],
    token: 'token-cashier',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

function contractError(
  status: number,
  items: Array<{ field: string | null; code: string; message: string }>,
) {
  return HttpResponse.json({ detail: items }, { status })
}

function okCheck() {
  return http.post('*/clients/check', () =>
    HttpResponse.json({
      found: false,
      is_blocked: false,
      blocked_reason: null,
      client_id: null,
    }),
  )
}

function pageBanners() {
  return screen.queryAllByRole('alert').filter((el) => !el.id.endsWith('-error'))
}

function expectNoBanner(message: string) {
  expect(pageBanners().some((el) => el.textContent?.includes(message))).toBe(false)
}

async function fillRequiredClient(
  user: ReturnType<typeof userEvent.setup>,
  documentValue: string,
) {
  await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez')
  await user.type(screen.getByLabelText('Número de documento'), documentValue)
  await user.type(screen.getByLabelText('Teléfono'), '8095551111')
  await user.type(screen.getByLabelText('Dirección'), 'Calle 1')
}

async function addGarante(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  documentValue: string,
) {
  await user.click(screen.getByRole('button', { name: 'Agregar garante' }))
  const group = screen.getByRole('group', { name: `Garante ${index + 1}` })
  await user.type(within(group).getByLabelText('Nombre'), `Garante ${index + 1}`)
  await user.type(within(group).getByLabelText('Teléfono'), '8095552222')
  await user.type(within(group).getByLabelText('Relación'), 'Hermano')
  await user.selectOptions(within(group).getByLabelText('Tipo de documento (opcional)'), 'cedula')
  await user.type(within(group).getByLabelText('Número de documento (opcional)'), documentValue)
}

function contactFixture(overrides: Partial<ContactRead> = {}): ContactRead {
  return {
    id: 'ct-1',
    client_id: 'cli-1',
    type: 'garante',
    name: 'Garante 1',
    phone: '8095552222',
    relationship: 'Hermano',
    address: null,
    doc_type: 'cedula',
    document: '001-7654321-0',
    has_document: true,
    document_available: true,
    is_active: true,
    ...overrides,
  }
}

describe('CBF-215 errores de documento en el campo', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('crear con documento duplicado muestra el error en el input, sin banner, y enfoca el campo', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients', () => contractError(409, [CBF_215_DOCUMENT_EXISTS])),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await fillRequiredClient(user, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    const input = await screen.findByLabelText('Número de documento')
    await waitFor(() => {
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_DOCUMENT_EXISTS.message,
      )
    })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveFocus()
    expectNoBanner(CBF_215_DOCUMENT_EXISTS.message)
  })

  it('editar con documento duplicado (PATCH /clients/:id) muestra el error en el input', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.patch('*/clients/:id', () => contractError(409, [CBF_215_DOCUMENT_EXISTS])),
    )
    window.history.pushState({}, '', '/clientes/cli-1/editar')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Editar cliente' })).toBeInTheDocument()
    const input = screen.getByLabelText('Número de documento')
    await user.clear(input)
    await user.type(input, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_DOCUMENT_EXISTS.message,
      )
    })
    expect(screen.getByLabelText('Número de documento')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Número de documento')).toHaveFocus()
    expectNoBanner(CBF_215_DOCUMENT_EXISTS.message)
  })

  it('documento inválido en POST /clients va al input del cliente', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients', () => contractError(422, [CBF_215_CEDULA_INVALID])),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    await waitFor(() => {
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })
    expect(screen.getByLabelText('Número de documento')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Número de documento')).toHaveFocus()
    expectNoBanner(CBF_215_CEDULA_INVALID.message)
  })

  it('pasaporte inválido en POST /clients muestra el message del backend', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients', () => contractError(422, [CBF_215_PASSPORT_INVALID])),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Tipo de documento'), 'pasaporte')
    await fillRequiredClient(user, 'AB12')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    await waitFor(() => {
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_PASSPORT_INVALID.message,
      )
    })
    expectNoBanner(CBF_215_PASSPORT_INVALID.message)
  })

  it('documento inválido en el garante de índice 1 (POST /clients/:id/contacts) va a su input', async () => {
    loginCashier()
    let contactCreates = 0
    server.use(
      okCheck(),
      http.post('*/clients/:id/contacts', async () => {
        contactCreates += 1
        if (contactCreates === 2) {
          return contractError(422, [CBF_215_CEDULA_INVALID])
        }
        return HttpResponse.json(
          contactFixture({ id: `ct-new-${contactCreates}`, name: `Garante ${contactCreates}` }),
          { status: 201 },
        )
      }),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await addGarante(user, 0, '001-2222222-2')
    await addGarante(user, 1, '001-3333333-3')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    await waitFor(() => {
      expect(document.getElementById('contacts.1.document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })
    const garante2 = screen.getByRole('group', { name: 'Garante 2' })
    const guarantorInput = within(garante2).getByLabelText('Número de documento (opcional)')
    expect(guarantorInput).toHaveAttribute('aria-invalid', 'true')
    expect(guarantorInput).toHaveFocus()
    expect(document.getElementById('document-error')).toBeNull()
    expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')
    expectNoBanner(CBF_215_CEDULA_INVALID.message)
    expect(contactCreates).toBe(2)
  })

  it('PATCH /clients/:id/contacts/:id de un garante pone el error en su document', async () => {
    loginCashier()
    const first = contactFixture({ id: 'ct-1', name: 'Garante 1', document: '001-2222222-2' })
    const second = contactFixture({ id: 'ct-2', name: 'Garante 2', document: '001-3333333-3' })
    server.use(
      okCheck(),
      http.get('*/clients/:id', () =>
        HttpResponse.json(clientFixture({ id: 'cli-1', contacts: [first, second] })),
      ),
      http.patch('*/clients/:id/contacts/:contactId', ({ params }) => {
        if (String(params.contactId) === 'ct-2') {
          return contractError(422, [CBF_215_PASSPORT_INVALID])
        }
        return HttpResponse.json(first)
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/editar')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Editar cliente' })).toBeInTheDocument()
    const garante2 = await screen.findByRole('group', { name: 'Garante 2' })
    const input = within(garante2).getByLabelText('Número de documento (opcional)')
    await user.clear(input)
    await user.type(input, 'ZZ1')
    await user.selectOptions(within(garante2).getByLabelText('Tipo de documento (opcional)'), 'pasaporte')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(document.getElementById('contacts.1.document-error')).toHaveTextContent(
        CBF_215_PASSPORT_INVALID.message,
      )
    })
    expect(within(garante2).getByLabelText('Número de documento (opcional)')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expectNoBanner(CBF_215_PASSPORT_INVALID.message)
  })

  it('un 422 de POST /clients/check va al campo documento', async () => {
    loginCashier()
    server.use(http.post('*/clients/check', () => contractError(422, [CBF_215_CEDULA_INVALID])))
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Número de documento'), '001-1111111-1')
    await user.tab()

    await waitFor(() => {
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })
    expect(screen.getByLabelText('Número de documento')).toHaveAttribute('aria-invalid', 'true')
    expectNoBanner(CBF_215_CEDULA_INVALID.message)
  })

  it('en Verificar, un 422 de /clients/check va al campo y no al banner', async () => {
    loginCashier()
    server.use(http.post('*/clients/check', () => contractError(422, [CBF_215_CEDULA_INVALID])))
    window.history.pushState({}, '', '/verificar')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Verificar bloqueo' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Número de documento'), '001-1111111-1')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    await waitFor(() => {
      expect(document.getElementById('check-document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })
    expect(screen.getByLabelText('Número de documento')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('No se pudo verificar. Inténtalo de nuevo.')).not.toBeInTheDocument()
  })

  it('formato viejo: con field null el banner sigue funcionando', async () => {
    loginCashier()
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await fillRequiredClient(user, 'malo')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    const cedulaBanner = await screen.findByText('Cédula no válida. Revisa los 11 dígitos.')
    expect(cedulaBanner.closest('[role="alert"]')).toBeTruthy()
    expect(cedulaBanner.id).not.toBe('document-error')
    expect(document.getElementById('document-error')).toBeNull()
    expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')
  })

  it('formato viejo: 409 CLIENT_DOCUMENT_EXISTS con field null va al banner, no al campo', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients', () =>
        contractError(409, [
          {
            field: null,
            code: 'CLIENT_DOCUMENT_EXISTS',
            message: 'Ya hay un cliente con este documento.',
          },
        ]),
      ),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await fillRequiredClient(user, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    const banner = await screen.findByText('Ya hay un cliente con este documento.')
    expect(banner.closest('[role="alert"]')).toBeTruthy()
    expect(banner.id).not.toBe('document-error')
    expect(document.getElementById('document-error')).toBeNull()
    expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')
  })

  it('formato viejo: PATCH /clients/:id 409 CLIENT_DOCUMENT_EXISTS con field null va al banner, no al campo', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.patch('*/clients/:id', () =>
        contractError(409, [
          {
            field: null,
            code: 'CLIENT_DOCUMENT_EXISTS',
            message: 'Ya hay un cliente con este documento.',
          },
        ]),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/editar')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Editar cliente' })).toBeInTheDocument()
    const input = screen.getByLabelText('Número de documento')
    await user.clear(input)
    await user.type(input, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    const banner = await screen.findByText('Ya hay un cliente con este documento.')
    expect(banner.closest('[role="alert"]')).toBeTruthy()
    expect(banner.id).not.toBe('document-error')
    expect(document.getElementById('document-error')).toBeNull()
    expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')
  })

  it('al editar el campo el error se borra', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients', () => contractError(409, [CBF_215_DOCUMENT_EXISTS])),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await fillRequiredClient(user, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    await waitFor(() => {
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_DOCUMENT_EXISTS.message,
      )
    })

    await user.type(screen.getByLabelText('Número de documento'), '0')
    expect(document.getElementById('document-error')).toBeNull()
    expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')
  })

  it('al editar el campo en PATCH /clients/:id el error se borra', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.patch('*/clients/:id', () => contractError(409, [CBF_215_DOCUMENT_EXISTS])),
    )
    window.history.pushState({}, '', '/clientes/cli-1/editar')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Editar cliente' })).toBeInTheDocument()
    const input = screen.getByLabelText('Número de documento')
    await user.clear(input)
    await user.type(input, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => {
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_DOCUMENT_EXISTS.message,
      )
    })

    await user.type(screen.getByLabelText('Número de documento'), '0')
    expect(document.getElementById('document-error')).toBeNull()
    expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')
  })

  it('al editar el documento de un contacto el error de PATCH se borra', async () => {
    loginCashier()
    const first = contactFixture({ id: 'ct-1', name: 'Garante 1', document: '001-2222222-2' })
    server.use(
      okCheck(),
      http.get('*/clients/:id', () =>
        HttpResponse.json(clientFixture({ id: 'cli-1', contacts: [first] })),
      ),
      http.patch('*/clients/:id/contacts/:contactId', () =>
        contractError(422, [CBF_215_CEDULA_INVALID]),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/editar')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Editar cliente' })).toBeInTheDocument()
    const garante = screen.getByRole('group', { name: 'Garante 1' })
    const contactInput = within(garante).getByLabelText('Número de documento (opcional)')
    await user.clear(contactInput)
    await user.type(contactInput, '001-1111111-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => {
      expect(document.getElementById('contacts.0.document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })

    await user.type(within(garante).getByLabelText('Número de documento (opcional)'), '0')
    expect(document.getElementById('contacts.0.document-error')).toBeNull()
    expect(within(garante).getByLabelText('Número de documento (opcional)')).not.toHaveAttribute(
      'aria-invalid',
    )
  })

  it('un 422 field foo o guarantors.1.document muestra banner en el form de cliente', async () => {
    loginCashier()
    const cases = [
      { field: 'foo', message: 'Revisa este valor.' },
      { field: 'guarantors.1.document', message: 'Revisa el documento del garante.' },
    ]
    for (const item of cases) {
      server.use(
        okCheck(),
        http.post('*/clients', () =>
          contractError(422, [{ field: item.field, code: 'value_error', message: item.message }]),
        ),
      )
      window.history.pushState({}, '', '/clientes/nuevo')
      const user = userEvent.setup()
      const view = renderApp()
      expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
      await fillRequiredClient(user, '001-1111111-1')
      await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
      const banner = await screen.findByText(item.message)
      expect(banner.closest('[role="alert"]')).toBeTruthy()
      expect(document.getElementById('document-error')).toBeNull()
      expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')
      view.unmount()
    }
  })

  it('un 422 field foo o guarantors.1.document muestra banner en el composer', async () => {
    loginCashier()
    const cases = [
      { field: 'foo', message: 'Revisa este valor.' },
      { field: 'guarantors.1.document', message: 'Revisa el documento del garante.' },
    ]
    for (const item of cases) {
      server.use(
        http.post('*/clients/:id/contacts', () =>
          contractError(422, [{ field: item.field, code: 'value_error', message: item.message }]),
        ),
      )
      window.history.pushState({}, '', '/clientes/cli-1')
      const user = userEvent.setup()
      const view = renderApp()
      expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Agregar garante' }))
      await user.type(screen.getByLabelText('Nombre'), 'Pedro Gómez')
      await user.type(screen.getByLabelText('Teléfono'), '8095552222')
      await user.type(screen.getByLabelText('Relación'), 'Hermano')
      await user.click(screen.getByRole('button', { name: 'Guardar contacto' }))
      const banner = await screen.findByText(item.message)
      expect(banner.closest('[role="alert"]')).toBeTruthy()
      expect(document.getElementById('new-contact-document-error')).toBeNull()
      view.unmount()
    }
  })

  it('un field desconocido (doc_type) en el contact card va al banner', async () => {
    loginCashier()
    const first = contactFixture({ id: 'ct-1', name: 'Garante 1' })
    server.use(
      http.get('*/clients/:id', () =>
        HttpResponse.json(clientFixture({ id: 'cli-1', contacts: [first] })),
      ),
      http.patch('*/clients/:id/contacts/:contactId', () =>
        contractError(422, [
          { field: 'doc_type', code: 'value_error', message: 'Revisa este tipo de documento.' },
        ]),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const phone = screen.getByLabelText('Teléfono')
    await user.clear(phone)
    await user.type(phone, '8095550000')
    await user.click(screen.getByRole('button', { name: 'Guardar contacto' }))
    const banner = await screen.findByText('Revisa este tipo de documento.')
    expect(banner.closest('[role="alert"]')).toBeTruthy()
    expect(document.getElementById('ct-1-document-error')).toBeNull()
  })

  it('contacts.N.document fuera de rango va al banner', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients', () =>
        contractError(422, [
          {
            field: 'contacts.1.document',
            code: 'value_error',
            message: 'Revisa el documento del garante.',
          },
        ]),
      ),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await addGarante(user, 0, '001-2222222-2')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    const banner = await screen.findByText('Revisa el documento del garante.')
    expect(banner.closest('[role="alert"]')).toBeTruthy()
    expect(document.getElementById('document-error')).toBeNull()
    expect(document.getElementById('contacts.0.document-error')).toBeNull()
    expect(document.getElementById('contacts.1.document-error')).toBeNull()
  })
})
