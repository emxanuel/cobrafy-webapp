import { cleanup, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { users } from './fixtures'
import { renderApp } from './render'
import { server } from './server'

async function loginAs(email: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Correo'), email)
  await user.type(screen.getByLabelText('Contraseña'), 'secreto123')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('historial del cliente', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('página el historial con limit, before y next_cursor', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('Bloqueo')).toBeInTheDocument()
    expect(screen.getByText('mora reiterada')).toBeInTheDocument()
    expect(screen.getByText(/Alguien del negocio/)).toBeInTheDocument()
    expect(screen.getByText('Aún no hay compras registradas para este cliente.')).toBeInTheDocument()
    expect(screen.getByText('Aún no hay pagos registrados para este cliente.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver más' }))
    expect(await screen.findByText('Se asignó cobrador')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument()
  })

  it('el cobrador no ve al autor y enmascara el documento', async () => {
    renderApp()
    await loginAs(users.collector.email)
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('Bloqueo')).toBeInTheDocument()
    expect(screen.getByText(/•••-••••567-8/)).toBeInTheDocument()
    expect(screen.queryByText('001-1234567-8')).not.toBeInTheDocument()
    expect(screen.queryByText(/Alguien del negocio/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Olivia Dueña/)).not.toBeInTheDocument()
  })

  it('muestra el vacío de la ficha', async () => {
    renderApp()
    await loginAs(users.cashier.email)
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-empty-history/historial')
    renderApp()
    expect(await screen.findByText('Aún no hay movimientos en esta ficha.')).toBeInTheDocument()
  })

  it('muestra error y permite reintentar', async () => {
    renderApp()
    await loginAs(users.cashier.email)
    cleanup()
    server.use(
      http.get('*/clients/:id/history', () =>
        HttpResponse.json({ detail: 'falló' }, { status: 500 }),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('No se pudo cargar el historial.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('un cliente inexistente muestra 404', async () => {
    renderApp()
    await loginAs(users.cashier.email)
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-missing/historial')
    renderApp()
    expect(
      await screen.findByText('Este cliente no existe o ya no está disponible.'),
    ).toBeInTheDocument()
  })
})
