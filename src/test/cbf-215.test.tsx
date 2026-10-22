import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useBusinessStore } from '@/features/business/stores/business-store'
import {
  BACK_LABEL,
  CLIENT_AND_GUARANTOR_SAVED_TOAST,
  CLIENT_SAVED_BANNER_BODY,
  CLIENT_SAVED_BANNER_TITLE,
  COMPLETE_GUARANTOR_TITLE,
  CONTACT_SAVED_LABEL,
  GO_TO_RECORD_LABEL,
  SAVE_GUARANTOR_LABEL,
} from '@/features/clients/lib/complete-guarantor'
import type { ContactCreate, ContactRead } from '@/features/clients/services/types'
import {
  CBF_215_CEDULA_INVALID,
  CBF_215_DOCUMENT_EXISTS,
  CBF_215_PASSPORT_INVALID,
  businesses,
  clientFixture,
  membership,
  users,
} from './fixtures'
import { clientWrites, contactWrites, persistCreatedContact } from './handlers'
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
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    const input = await screen.findByLabelText('Número de documento', {}, { timeout: 4000 })
    await waitFor(
      () => {
        expect(document.getElementById('document-error')).toHaveTextContent(
          CBF_215_DOCUMENT_EXISTS.message,
        )
      },
      { timeout: 4000 },
    )
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
    expect(await screen.findByRole('heading', { name: 'Editar cliente' }, { timeout: 4000 })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'Editar cliente' }, { timeout: 4000 })).toBeInTheDocument()
    const garante2 = await screen.findByRole('group', { name: 'Garante 2' }, { timeout: 4000 })
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
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'Verificar bloqueo' }, { timeout: 4000 })).toBeInTheDocument()
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
    server.use(
      http.post('*/clients', () =>
        contractError(422, [
          {
            field: null,
            code: 'value_error',
            message: 'Cédula no válida. Revisa los 11 dígitos.',
          },
        ]),
      ),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, 'malo')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    const cedulaBanner = await screen.findByText('Cédula no válida. Revisa los 11 dígitos.', {}, { timeout: 4000 })
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
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    const banner = await screen.findByText('Ya hay un cliente con este documento.', {}, { timeout: 4000 })
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
    expect(await screen.findByRole('heading', { name: 'Editar cliente' }, { timeout: 4000 })).toBeInTheDocument()
    const input = screen.getByLabelText('Número de documento')
    await user.clear(input)
    await user.type(input, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    const banner = await screen.findByText('Ya hay un cliente con este documento.', {}, { timeout: 4000 })
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
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
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

  it('cambiar el tipo de documento limpia el error del documento', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients', () => contractError(409, [CBF_215_DOCUMENT_EXISTS])),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-9999999-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    await waitFor(() => {
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_DOCUMENT_EXISTS.message,
      )
    })

    await user.selectOptions(screen.getByLabelText('Tipo de documento'), 'pasaporte')
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
    expect(await screen.findByRole('heading', { name: 'Editar cliente' }, { timeout: 4000 })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'Editar cliente' }, { timeout: 4000 })).toBeInTheDocument()
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
      expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
      await fillRequiredClient(user, '001-1111111-1')
      await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
      const banner = await screen.findByText(item.message, {}, { timeout: 4000 })
      expect(banner.closest('[role="alert"]')).toBeTruthy()
      expect(document.getElementById('document-error')).toBeNull()
      expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')
      view.unmount()
    }
  })

  it('con error de documento y otro foo el banner no repite el texto del campo', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients', () =>
        contractError(422, [
          CBF_215_CEDULA_INVALID,
          { field: 'foo', code: 'value_error', message: 'Revisa este valor.' },
        ]),
      ),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    await waitFor(() => {
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })
    const banner = await screen.findByText('Revisa este valor.', {}, { timeout: 4000 })
    expect(banner.closest('[role="alert"]')).toBeTruthy()
    expect(banner).not.toHaveTextContent(CBF_215_CEDULA_INVALID.message)
    expectNoBanner(CBF_215_CEDULA_INVALID.message)
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
      expect(await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Agregar garante' }))
      await user.type(screen.getByLabelText('Nombre'), 'Pedro Gómez')
      await user.type(screen.getByLabelText('Teléfono'), '8095552222')
      await user.type(screen.getByLabelText('Relación'), 'Hermano')
      await user.click(screen.getByRole('button', { name: 'Guardar contacto' }))
      const banner = await screen.findByText(item.message, {}, { timeout: 4000 })
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
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const phone = screen.getByLabelText('Teléfono')
    await user.clear(phone)
    await user.type(phone, '8095550000')
    await user.click(screen.getByRole('button', { name: 'Guardar contacto' }))
    const banner = await screen.findByText('Revisa este tipo de documento.', {}, { timeout: 4000 })
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
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await addGarante(user, 0, '001-2222222-2')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    const banner = await screen.findByText('Revisa el documento del garante.', {}, { timeout: 4000 })
    expect(banner.closest('[role="alert"]')).toBeTruthy()
    expect(document.getElementById('document-error')).toBeNull()
    expect(document.getElementById('contacts.0.document-error')).toBeNull()
    expect(document.getElementById('contacts.1.document-error')).toBeNull()
  })

  it('reintento de nuevo cliente con garante inválido no duplica el POST /clients', async () => {
    loginCashier()
    const contactPosts: ContactCreate[] = []
    server.use(
      okCheck(),
      http.post('*/clients/:id/contacts', async ({ request, params }) => {
        const payload = (await request.json()) as ContactCreate
        contactPosts.push(payload)
        if (payload.document === '001-0000001-1') {
          return contractError(422, [CBF_215_CEDULA_INVALID])
        }
        return HttpResponse.json(persistCreatedContact(String(params.id), payload), {
          status: 201,
        })
      }),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await addGarante(user, 0, '001-0000001-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    await waitFor(() => {
      expect(document.getElementById('contacts.0.document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })
    expect(screen.getByRole('heading', { name: COMPLETE_GUARANTOR_TITLE })).toBeInTheDocument()
    const resumeBanner = screen.getByRole('status')
    expect(resumeBanner).toHaveTextContent(CLIENT_SAVED_BANNER_TITLE)
    expect(resumeBanner).toHaveTextContent(CLIENT_SAVED_BANNER_BODY)
    expect(resumeBanner).not.toHaveTextContent(CBF_215_CEDULA_INVALID.message)
    expectNoBanner(CBF_215_DOCUMENT_EXISTS.message)
    expectNoBanner(CBF_215_CEDULA_INVALID.message)
    expect(screen.getByLabelText('Número de documento')).toHaveAttribute('readOnly')
    expect(screen.getByLabelText('Número de documento')).not.toBeDisabled()
    expect(screen.getByLabelText('Dirección')).toHaveAttribute('readOnly')
    expect(screen.getByLabelText('Dirección')).not.toBeDisabled()
    const group = screen.getByRole('group', { name: 'Garante 1' })
    const input = within(group).getByLabelText('Número de documento (opcional)')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveFocus()
    expect(clientWrites.filter((item) => item.method === 'POST')).toHaveLength(1)
    expect(contactPosts).toHaveLength(1)

    await user.clear(input)
    await user.type(input, '001-7654321-0')
    await user.click(screen.getByRole('button', { name: SAVE_GUARANTOR_LABEL }))

    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(await screen.findByText(CLIENT_AND_GUARANTOR_SAVED_TOAST, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText(/Garante 1/)).toBeInTheDocument()
    expect(clientWrites.filter((item) => item.method === 'POST')).toHaveLength(1)
    expect(contactPosts).toHaveLength(2)
    expect(contactPosts[1]?.document).toBe('001-7654321-0')
  })

  it('reintento al editar no duplica el garante ya guardado', async () => {
    loginCashier()
    const contactPosts: ContactCreate[] = []
    server.use(
      okCheck(),
      http.post('*/clients/:id/contacts', async ({ request, params }) => {
        const payload = (await request.json()) as ContactCreate
        contactPosts.push(payload)
        if (payload.document === '001-0000001-1') {
          return contractError(422, [CBF_215_CEDULA_INVALID])
        }
        return HttpResponse.json(persistCreatedContact(String(params.id), payload), {
          status: 201,
        })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/editar')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Editar cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await addGarante(user, 0, '001-2222222-2')
    await addGarante(user, 1, '001-0000001-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(document.getElementById('contacts.1.document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })
    expect(screen.getByRole('heading', { name: 'Editar cliente' })).toBeInTheDocument()
    expect(contactPosts.map((item) => item.name)).toEqual(['Garante 1', 'Garante 2'])

    const group = screen.getByRole('group', { name: 'Garante 2' })
    const input = within(group).getByLabelText('Número de documento (opcional)')
    await user.clear(input)
    await user.type(input, '001-3333333-3')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(contactPosts.map((item) => item.name)).toEqual(['Garante 1', 'Garante 2', 'Garante 2'])
    expect(contactPosts.filter((item) => item.name === 'Garante 1')).toHaveLength(1)
    expect(contactPosts[2]?.document).toBe('001-3333333-3')
    expect(screen.getAllByText(/Garante 1 ·/).length).toBe(1)
    expect(screen.getByText(/Garante 2 ·/)).toBeInTheDocument()
  })

  it('Ir a la ficha navega sin reenviar el garante pendiente', async () => {
    loginCashier()
    const contactPosts: ContactCreate[] = []
    server.use(
      okCheck(),
      http.post('*/clients/:id/contacts', async ({ request }) => {
        const payload = (await request.json()) as ContactCreate
        contactPosts.push(payload)
        return contractError(422, [CBF_215_CEDULA_INVALID])
      }),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await addGarante(user, 0, '001-0000001-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    expect(await screen.findByRole('heading', { name: COMPLETE_GUARANTOR_TITLE }, { timeout: 4000 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: GO_TO_RECORD_LABEL }))
    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(contactPosts).toHaveLength(1)
    expect(screen.queryByText(CLIENT_AND_GUARANTOR_SAVED_TOAST)).not.toBeInTheDocument()
    expect(screen.queryByText('Este cliente no tiene garante.')).not.toBeInTheDocument()
  })

  it('Atrás sale de Completar garante sin diálogo', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients/:id/contacts', () => contractError(422, [CBF_215_CEDULA_INVALID])),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await addGarante(user, 0, '001-0000001-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    expect(await screen.findByRole('heading', { name: COMPLETE_GUARANTOR_TITLE }, { timeout: 4000 })).toBeInTheDocument()

    const confirm = vi.spyOn(window, 'confirm')
    await user.click(screen.getByRole('link', { name: BACK_LABEL }))
    expect(confirm).not.toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Clientes' }, { timeout: 4000 })).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('varios garantes: el guardado queda en solo lectura y el inválido sigue editable', async () => {
    loginCashier()
    const contactPosts: ContactCreate[] = []
    server.use(
      okCheck(),
      http.post('*/clients/:id/contacts', async ({ request, params }) => {
        const payload = (await request.json()) as ContactCreate
        contactPosts.push(payload)
        if (payload.document === '001-0000001-1') {
          return contractError(422, [CBF_215_CEDULA_INVALID])
        }
        return HttpResponse.json(persistCreatedContact(String(params.id), payload), {
          status: 201,
        })
      }),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await addGarante(user, 0, '001-2222222-2')
    await addGarante(user, 1, '001-0000001-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    expect(await screen.findByRole('heading', { name: COMPLETE_GUARANTOR_TITLE }, { timeout: 4000 })).toBeInTheDocument()
    const saved = screen.getByRole('group', { name: 'Garante 1' })
    expect(await within(saved).findByText(CONTACT_SAVED_LABEL, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(within(saved).getByLabelText('Nombre')).toBeDisabled()
    expect(within(saved).getByLabelText('Número de documento (opcional)')).toBeDisabled()
    expect(within(saved).queryByText(CBF_215_CEDULA_INVALID.message)).not.toBeInTheDocument()

    const pending = screen.getByRole('group', { name: 'Garante 2' })
    const pendingInput = within(pending).getByLabelText('Número de documento (opcional)')
    expect(within(pending).queryByText(CONTACT_SAVED_LABEL)).not.toBeInTheDocument()
    expect(pendingInput).toBeEnabled()
    expect(pendingInput).toHaveAttribute('aria-invalid', 'true')
    expect(pendingInput).toHaveFocus()
    expect(document.getElementById('contacts.1.document-error')).toHaveTextContent(
      CBF_215_CEDULA_INVALID.message,
    )
    expect(screen.getByRole('status')).not.toHaveTextContent(CBF_215_CEDULA_INVALID.message)
    expect(contactPosts.map((item) => item.name)).toEqual(['Garante 1', 'Garante 2'])

    await user.clear(pendingInput)
    await user.type(pendingInput, '001-3333333-3')
    await user.click(screen.getByRole('button', { name: SAVE_GUARANTOR_LABEL }))
    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(contactPosts.filter((item) => item.name === 'Garante 1')).toHaveLength(1)
    expect(contactPosts.map((item) => item.name)).toEqual(['Garante 1', 'Garante 2', 'Garante 2'])
    expect(await screen.findByText(CLIENT_AND_GUARANTOR_SAVED_TOAST, {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('quitar un contacto ya creado y reintentar hace DELETE + POST, no PATCH de otro contacto', async () => {
    loginCashier()
    const contactPosts: ContactCreate[] = []
    let savedId = ''
    server.use(
      okCheck(),
      http.post('*/clients/:id/contacts', async ({ request, params }) => {
        const payload = (await request.json()) as ContactCreate
        contactPosts.push(payload)
        if (payload.document === '001-0000001-1') {
          return contractError(422, [CBF_215_CEDULA_INVALID])
        }
        const saved = persistCreatedContact(String(params.id), payload)
        if (!savedId) savedId = saved.id
        return HttpResponse.json(saved, { status: 201 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/editar')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Editar cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await addGarante(user, 0, '001-2222222-2')
    await addGarante(user, 1, '001-0000001-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => {
      expect(document.getElementById('contacts.1.document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(
      within(screen.getByRole('group', { name: 'Garante 1' })).getByRole('button', {
        name: 'Quitar',
      }),
    )
    confirm.mockRestore()

    const remaining = screen.getByRole('group', { name: 'Garante 1' })
    const input = within(remaining).getByLabelText('Número de documento (opcional)')
    await user.clear(input)
    await user.type(input, '001-3333333-3')
    contactWrites.length = 0
    const postsBeforeRetry = contactPosts.length
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(contactWrites.filter((item) => item.method === 'DELETE')).toHaveLength(1)
    expect(contactWrites.filter((item) => item.method === 'DELETE')[0]?.url).toContain(savedId)
    const patches = contactWrites.filter((item) => item.method === 'PATCH')
    expect(patches).toHaveLength(0)
    expect(contactPosts.slice(postsBeforeRetry)).toEqual([
      expect.objectContaining({ name: 'Garante 2', document: '001-3333333-3' }),
    ])
    expect(
      patches.some((item) => (item.body as { document?: string }).document === '001-3333333-3'),
    ).toBe(false)
  })

  it('si se cambia el nombre del cliente antes de reintentar, el PATCH lleva el nombre nuevo', async () => {
    loginCashier()
    server.use(
      okCheck(),
      http.post('*/clients/:id/contacts', async ({ request, params }) => {
        const payload = (await request.json()) as ContactCreate
        if (payload.document === '001-0000001-1') {
          return contractError(422, [CBF_215_CEDULA_INVALID])
        }
        return HttpResponse.json(persistCreatedContact(String(params.id), payload), {
          status: 201,
        })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/editar')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Editar cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await addGarante(user, 0, '001-0000001-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => {
      expect(document.getElementById('contacts.0.document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })

    const nameInput = document.getElementById('name') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Ana Editada')
    const group = screen.getByRole('group', { name: 'Garante 1' })
    await user.clear(within(group).getByLabelText('Número de documento (opcional)'))
    await user.type(within(group).getByLabelText('Número de documento (opcional)'), '001-7654321-0')
    clientWrites.length = 0
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await screen.findByRole('heading', { name: 'Ana Editada' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    const patches = clientWrites.filter((item) => item.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0]?.body).toEqual({ name: 'Ana Editada' })
  })

  it('un doble click al guardar no dispara dos POST /clients', async () => {
    loginCashier()
    server.use(okCheck())
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(clientWrites.filter((item) => item.method === 'POST')).toHaveLength(1)
  })

  it('un doble click al reintentar no dispara dos POST de contacto', async () => {
    loginCashier()
    const contactPosts: ContactCreate[] = []
    server.use(
      okCheck(),
      http.post('*/clients/:id/contacts', async ({ request, params }) => {
        const payload = (await request.json()) as ContactCreate
        contactPosts.push(payload)
        if (payload.document === '001-0000001-1') {
          return contractError(422, [CBF_215_CEDULA_INVALID])
        }
        return HttpResponse.json(persistCreatedContact(String(params.id), payload), {
          status: 201,
        })
      }),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 })).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await addGarante(user, 0, '001-0000001-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    await waitFor(() => {
      expect(document.getElementById('contacts.0.document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })
    const group = screen.getByRole('group', { name: 'Garante 1' })
    const input = within(group).getByLabelText('Número de documento (opcional)')
    await user.clear(input)
    await user.type(input, '001-7654321-0')
    const postsBeforeRetry = contactPosts.length
    fireEvent.click(screen.getByRole('button', { name: SAVE_GUARANTOR_LABEL }))
    fireEvent.click(screen.getByRole('button', { name: SAVE_GUARANTOR_LABEL }))
    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(contactPosts.slice(postsBeforeRetry)).toHaveLength(1)
  })

  it('en Completar garante el cliente es readOnly, se puede enfocar y no dispara check ni PATCH', async () => {
    loginCashier()
    const checks: unknown[] = []
    const contactPosts: ContactCreate[] = []
    server.use(
      http.post('*/clients/check', async ({ request }) => {
        checks.push(await request.json())
        return HttpResponse.json({
          found: false,
          is_blocked: false,
          blocked_reason: null,
          client_id: null,
        })
      }),
      http.post('*/clients/:id/contacts', async ({ request, params }) => {
        const payload = (await request.json()) as ContactCreate
        contactPosts.push(payload)
        if (payload.document === '001-0000001-1') {
          return contractError(422, [CBF_215_CEDULA_INVALID])
        }
        return HttpResponse.json(persistCreatedContact(String(params.id), payload), {
          status: 201,
        })
      }),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(
      await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    await addGarante(user, 0, '001-0000001-1')
    const checksAfterFill = checks.length
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    expect(
      await screen.findByRole('heading', { name: COMPLETE_GUARANTOR_TITLE }, { timeout: 4000 }),
    ).toBeInTheDocument()

    const name = document.getElementById('name') as HTMLInputElement
    const documentInput = document.getElementById('document') as HTMLInputElement
    const phone = document.getElementById('phone') as HTMLInputElement
    const address = document.getElementById('address') as HTMLInputElement
    const notes = document.getElementById('notes') as HTMLTextAreaElement
    const docType = document.getElementById('doc_type') as HTMLInputElement
    const collector = document.getElementById('collector_membership_id') as HTMLInputElement
    expect(document.querySelector('#doc_type')).not.toHaveAttribute('aria-readonly')
    expect(document.querySelector('select')).toBeNull()
    expect(docType.tagName).toBe('INPUT')
    expect(collector.tagName).toBe('INPUT')
    expect(docType).toHaveValue('Cédula')
    expect(collector).toHaveValue('Sin asignar')

    for (const field of [name, documentInput, phone, address, notes, docType, collector]) {
      expect(field).toHaveAttribute('readOnly')
      expect(field).not.toBeDisabled()
      field.focus()
      expect(field).toHaveFocus()
    }

    const beforeName = (name as HTMLInputElement).value
    const beforeDocument = (documentInput as HTMLInputElement).value
    const beforeDocType = (docType as HTMLInputElement).value
    await user.type(name, 'XXXX')
    await user.type(documentInput, '9')
    await user.type(docType, 'Pasaporte')
    expect(name).toHaveValue(beforeName)
    expect(documentInput).toHaveValue(beforeDocument)
    expect(docType).toHaveValue(beforeDocType)

    await user.tab()
    fireEvent.blur(documentInput)
    expect(checks.length).toBe(checksAfterFill)

    const group = screen.getByRole('group', { name: 'Garante 1' })
    const input = within(group).getByLabelText('Número de documento (opcional)')
    await user.clear(input)
    await user.type(input, '001-7654321-0')
    clientWrites.length = 0
    await user.click(screen.getByRole('button', { name: SAVE_GUARANTOR_LABEL }))
    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(clientWrites.filter((item) => item.method === 'PATCH')).toHaveLength(0)
    expect(clientWrites.filter((item) => item.method === 'POST')).toHaveLength(0)
    expect(contactPosts.at(-1)?.document).toBe('001-7654321-0')
  })

  it('la ficha vacía de garantes incluye Agregar garante, sin alerta', async () => {
    loginCashier()
    window.history.pushState({}, '', '/clientes/cli-1')
    renderApp()
    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Garantes' })).toBeInTheDocument()
    expect(screen.getByText('Sin garantes.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar garante' })).toBeInTheDocument()
    expect(screen.queryByText('Este cliente no tiene garante.')).not.toBeInTheDocument()
    expect(pageBanners()).toHaveLength(0)
  })

  it('respuesta rápida + doble click: un solo POST /clients', async () => {
    loginCashier()
    server.use(okCheck())
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(
      await screen.findByRole('heading', { name: 'Nuevo cliente' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    await fillRequiredClient(user, '001-1111111-1')
    const button = screen.getByRole('button', { name: 'Guardar cliente' })
    await user.dblClick(button)
    expect(
      await screen.findByRole('heading', { name: 'Ana Pérez' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(clientWrites.filter((item) => item.method === 'POST')).toHaveLength(1)
  })
})
