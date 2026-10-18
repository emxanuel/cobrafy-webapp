import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { useBusinessStore } from '@/features/business/stores/business-store'
import { businesses, membership, users } from './fixtures'
import { renderApp, seedAuth } from './render'
import { server } from './server'

function loginOwner() {
  seedAuth({
    user: users.owner,
    memberships: [membership(users.owner, businesses.norte, 'dueño')],
    token: 'token-owner',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

function loginCashier() {
  seedAuth({
    user: users.cashier,
    memberships: [membership(users.cashier, businesses.norte, 'cajero')],
    token: 'token-cashier',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

describe('CBF-210-A UI', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('members con LAST_ACTIVE_OWNER muestra el aviso del último dueño', async () => {
    loginOwner()
    window.history.pushState({}, '', '/equipo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Equipo' })).toBeInTheDocument()
    const people = (await screen.findByRole('heading', { name: 'Personas del negocio' }))
      .closest('section')
    expect(people).toBeTruthy()
    const ownerRow = (await within(people as HTMLElement).findByText('Olivia Dueña')).closest('li')
    expect(ownerRow).toBeTruthy()
    await user.click(within(ownerRow as HTMLElement).getByRole('button', { name: 'Desactivar' }))
    expect(
      await screen.findByText('El negocio debe tener al menos un dueño activo.'),
    ).toBeInTheDocument()
  })

  it('otro 409 al revocar muestra el mensaje del backend', async () => {
    loginOwner()
    server.use(
      http.post('*/invitations/:id/revoke', () =>
        HttpResponse.json(
          {
            detail: [
              {
                field: null,
                code: 'INVITATION_NOT_REVOCABLE',
                message: 'La invitación no se puede revocar',
              },
            ],
          },
          { status: 409 },
        ),
      ),
    )
    window.history.pushState({}, '', '/equipo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Equipo' })).toBeInTheDocument()
    expect(await screen.findByText('nuevo@negocio.com')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText('La invitación no se puede revocar')).toBeInTheDocument()
  })

  it('bloquear un cliente ya bloqueado muestra el aviso en la alerta, no en documento', async () => {
    loginCashier()
    server.use(
      http.post('*/clients/:id/block', () =>
        HttpResponse.json(
          {
            detail: [
              {
                field: null,
                code: 'CLIENT_ALREADY_BLOCKED',
                message: 'El cliente ya está bloqueado',
              },
            ],
          },
          { status: 409 },
        ),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1')
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Bloquear' }))
    await user.type(screen.getByLabelText('Motivo del bloqueo'), 'Atraso de 3 cuotas')
    await user.click(screen.getByRole('button', { name: 'Confirmar bloqueo' }))
    expect(await screen.findByText('El cliente ya está bloqueado')).toBeInTheDocument()
    expect(screen.queryByLabelText('Número de documento')).not.toBeInTheDocument()
  })

  it('la bitácora muestra badge, título y filtro de credit_settings, sin la palabra interés', async () => {
    loginOwner()
    server.use(
      http.get('*/audit', () =>
        HttpResponse.json({
          items: [
            {
              id: 'aud-credit-1',
              business_id: businesses.norte.id,
              user_id: users.owner.id,
              membership_id: membership(users.owner, businesses.norte, 'dueño').id,
              action: 'update',
              entity: 'credit_settings',
              entity_id: businesses.norte.id,
              before: { interest_method: 'recargo_fijo', surcharge_percent: '10.00' },
              after: { interest_method: 'recargo_fijo', surcharge_percent: '20.00' },
              ip: '127.0.0.1',
              user_agent: 'vitest',
              created_at: '2026-10-18T12:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        }),
      ),
    )
    window.history.pushState({}, '', '/auditoria')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Bitácora' })).toBeInTheDocument()
    const card = (await screen.findByText('Configuración de crédito editada')).closest('li')
    expect(card).toBeTruthy()
    expect(within(card as HTMLElement).getByText('Crédito')).toBeInTheDocument()

    const entity = screen.getByLabelText('Entidad')
    expect(within(entity).getByRole('option', { name: 'Crédito' })).toHaveValue('credit_settings')
    expect(within(entity).queryByRole('option', { name: /inter[eé]s/i })).not.toBeInTheDocument()

    await user.click(within(card as HTMLElement).getByText('Ver cambios'))
    expect(within(card as HTMLElement).getByText('Método de cálculo')).toBeInTheDocument()
    expect(within(card as HTMLElement).getAllByText('Recargo fijo').length).toBeGreaterThan(0)
    expect(within(card as HTMLElement).queryByText('recargo_fijo')).not.toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('Recargo (%)')).toBeInTheDocument()
    expect(within(card as HTMLElement).queryByText(/inter[eé]s/i)).not.toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toMatch(/inter[eé]s/i)
  })
})
