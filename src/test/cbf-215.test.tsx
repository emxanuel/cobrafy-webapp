import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { useBusinessStore } from '@/features/business/stores/business-store'
import {
  CBF_215_CEDULA_INVALID,
  CBF_215_DOCUMENT_EXISTS,
  businesses,
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

function pageBanners() {
  return screen.queryAllByRole('alert').filter((el) => !el.id.endsWith('-error'))
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
  await user.type(within(group).getByLabelText('Número de documento (opcional)'), documentValue)
}

describe('CBF-215 errores de documento en el campo', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('crear con documento duplicado muestra el error en el input, sin banner, y enfoca el campo', async () => {
    loginCashier()
    server.use(
      http.post('*/clients/check', () =>
        HttpResponse.json({
          found: false,
          is_blocked: false,
          blocked_reason: null,
          client_id: null,
        }),
      ),
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
    expect(pageBanners().some((el) => el.textContent?.includes(CBF_215_DOCUMENT_EXISTS.message))).toBe(
      false,
    )
  })

  it('editar con documento duplicado muestra el error en el input, sin banner, y enfoca el campo', async () => {
    loginCashier()
    server.use(
      http.post('*/clients/check', () =>
        HttpResponse.json({
          found: false,
          is_blocked: false,
          blocked_reason: null,
          client_id: null,
        }),
      ),
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
    expect(pageBanners().some((el) => el.textContent?.includes(CBF_215_DOCUMENT_EXISTS.message))).toBe(
      false,
    )
  })

  it('documento inválido en el cliente y en el garante de índice 1 va al input correcto', async () => {
    loginCashier()
    const guarantorInvalid = {
      field: 'guarantors.1.document',
      code: 'value_error',
      message: CBF_215_CEDULA_INVALID.message,
    } as const
    server.use(
      http.post('*/clients/check', () =>
        HttpResponse.json({
          found: false,
          is_blocked: false,
          blocked_reason: null,
          client_id: null,
        }),
      ),
      http.post('*/clients', () =>
        contractError(422, [CBF_215_CEDULA_INVALID, guarantorInvalid]),
      ),
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
      expect(document.getElementById('document-error')).toHaveTextContent(
        CBF_215_CEDULA_INVALID.message,
      )
    })
    const clientInput = screen.getByLabelText('Número de documento')
    expect(clientInput).toHaveAttribute('aria-invalid', 'true')
    expect(clientInput).toHaveFocus()

    const garante2 = screen.getByRole('group', { name: 'Garante 2' })
    const guarantorInput = within(garante2).getByLabelText('Número de documento (opcional)')
    expect(document.getElementById('contacts.1.document-error')).toHaveTextContent(
      CBF_215_CEDULA_INVALID.message,
    )
    expect(guarantorInput).toHaveAttribute('aria-invalid', 'true')
    expect(pageBanners().some((el) => el.textContent?.includes(CBF_215_CEDULA_INVALID.message))).toBe(
      false,
    )
  })

  it('con field null el banner sigue funcionando', async () => {
    loginCashier()
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await fillRequiredClient(user, 'malo')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    const cedulaBanner = await screen.findByText('Cédula inválida')
    expect(cedulaBanner.closest('[role="alert"]')).toBeTruthy()
    expect(cedulaBanner.id).not.toBe('document-error')
    expect(document.getElementById('document-error')).toBeNull()
    expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')
  })

  it('al editar el campo el error se borra', async () => {
    loginCashier()
    server.use(
      http.post('*/clients/check', () =>
        HttpResponse.json({
          found: false,
          is_blocked: false,
          blocked_reason: null,
          client_id: null,
        }),
      ),
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
})
