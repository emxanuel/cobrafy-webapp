import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { businesses, membership, ownerMember, users } from './fixtures'
import { renderApp, seedAuth } from './render'
import { server } from './server'

function seedCashier() {
  seedAuth({
    user: users.cashier,
    memberships: [membership(users.cashier, businesses.norte, 'cajero')],
    token: 'token-cashier',
  })
}

function seedCollector() {
  seedAuth({
    user: users.collector,
    memberships: [membership(users.collector, businesses.norte, 'cobrador')],
    token: 'token-collector',
  })
}

describe('historial del cliente', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('página el historial con limit, before y next_cursor', async () => {
    seedCashier()
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByText('Bloqueo')).toBeInTheDocument()
    expect(screen.getByText(/mora reiterada/)).toBeInTheDocument()
    expect(screen.getByText(/Alguien del negocio/)).toBeInTheDocument()
    expect(screen.getByText('Aún no hay compras registradas para este cliente.')).toBeInTheDocument()
    expect(screen.getByText('Aún no hay pagos registrados para este cliente.')).toBeInTheDocument()
    const more = await screen.findByRole('button', { name: 'Ver más' })
    expect(more).toBeEnabled()
    await user.click(more)
    expect(await screen.findByText('Se asignó cobrador')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument()
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })

  it('el cobrador no ve al autor y enmascara el documento', async () => {
    seedCollector()
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('Bloqueo')).toBeInTheDocument()
    expect(screen.getByText(/•••-••••567-8/)).toBeInTheDocument()
    expect(screen.queryByText('001-1234567-8')).not.toBeInTheDocument()
    expect(screen.queryByText(/Alguien del negocio/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Olivia Dueña/)).not.toBeInTheDocument()
  })

  it('el cobrador enmascara cédulas en el motivo y dice Asignado a ti', async () => {
    seedCollector()
    server.use(
      http.get('*/clients/:id/history', () =>
        HttpResponse.json({
          purchases: [],
          payments: [],
          overdue: [],
          follow_ups: [],
          next_cursor: null,
          events: [
            {
              id: 'h-block',
              type: 'blocked',
              occurred_at: '2026-01-02T10:00:00Z',
              actor: {
                user_id: users.owner.id,
                membership_id: ownerMember.id,
              },
              reason: 'deuda con 001-1234567-8',
              from_collector_membership_id: null,
              to_collector_membership_id: null,
            },
            {
              id: 'h-re',
              type: 'collector_reassigned',
              occurred_at: '2026-01-01T10:00:00Z',
              actor: {
                user_id: users.owner.id,
                membership_id: ownerMember.id,
              },
              reason: null,
              from_collector_membership_id: null,
              to_collector_membership_id: null,
            },
          ],
        }),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('Bloqueo')).toBeInTheDocument()
    expect(screen.getByText(/•••-••••567-8/)).toBeInTheDocument()
    expect(screen.queryByText('001-1234567-8')).not.toBeInTheDocument()
    expect(screen.getByText('Se reasignó cobrador')).toBeInTheDocument()
    expect(screen.getByText('Asignado a ti → Asignado a ti')).toBeInTheDocument()
  })

  it('muestra el vacío de la ficha', async () => {
    seedCashier()
    window.history.pushState({}, '', '/clientes/cli-empty-history/historial')
    renderApp()
    expect(await screen.findByText('Aún no hay movimientos en esta ficha.')).toBeInTheDocument()
  })

  it('muestra error y permite reintentar', async () => {
    seedCashier()
    server.use(
      http.get('*/clients/:id/history', () =>
        HttpResponse.json({ detail: 'falló' }, { status: 500 }),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(
      await screen.findByText('No se pudo cargar el historial.', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('un cliente inexistente muestra 404', async () => {
    seedCashier()
    window.history.pushState({}, '', '/clientes/cli-missing/historial')
    renderApp()
    expect(
      await screen.findByText('Este cliente no existe o ya no está disponible.'),
    ).toBeInTheDocument()
  })
})
