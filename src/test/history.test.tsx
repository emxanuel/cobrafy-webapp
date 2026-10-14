import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { users } from './fixtures'
import { renderApp } from './render'

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
    await user.click(screen.getByRole('button', { name: 'Ver más' }))
    expect(await screen.findByText('Se asignó cobrador')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument()
  })
})
