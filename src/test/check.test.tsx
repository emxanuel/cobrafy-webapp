import { cleanup, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { users } from './fixtures'
import { checkRequests } from './handlers'
import { renderApp } from './render'
import { server } from './server'

async function loginAs(email: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Correo'), email)
  await user.type(screen.getByLabelText('Contraseña'), 'secreto123')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('verificar bloqueo', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('valida la cédula y muestra bloqueado, libre y no existe', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.owner.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    cleanup()
    window.history.pushState({}, '', '/verificar')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Verificar bloqueo' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(screen.getByText('Escribe una cédula de 11 dígitos.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Número de documento'), '001-8888888-8')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('⛔ Bloqueado')).toBeInTheDocument()
    expect(screen.getByText(/Luis Bloqueado/)).toBeInTheDocument()
    expect(screen.getByText(/Atraso de 3 cuotas/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute(
      'href',
      '/clientes/cli-blocked',
    )
    expect(checkRequests.at(-1)?.body).toEqual({
      doc_type: 'cedula',
      document: '00188888888',
    })

    await user.clear(screen.getByLabelText('Número de documento'))
    await user.type(screen.getByLabelText('Número de documento'), '00112345678')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('✓ No está bloqueado')).toBeInTheDocument()
    expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument()
    expect(screen.getByText(/001-1234567-8/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Número de documento'))
    await user.type(screen.getByLabelText('Número de documento'), '00100000000')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('No encontramos ese documento')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar cliente' })).toBeInTheDocument()
  })

  it('el cobrador ve el documento enmascarado y no puede registrar', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.collector.email)
    cleanup()
    window.history.pushState({}, '', '/verificar')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Verificar bloqueo' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Número de documento'), '00112345678')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('✓ No está bloqueado')).toBeInTheDocument()
    expect(screen.getByText(/•••-••••567-8/)).toBeInTheDocument()
    expect(screen.queryByText('001-1234567-8')).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Número de documento'))
    await user.type(screen.getByLabelText('Número de documento'), '00100000000')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('No encontramos ese documento')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrar cliente' })).not.toBeInTheDocument()
  })

  it('muestra error de red y limpia el resultado al editar', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    cleanup()
    window.history.pushState({}, '', '/verificar')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Verificar bloqueo' })).toBeInTheDocument()
    server.use(
      http.post('*/clients/check', () =>
        HttpResponse.json({ detail: 'falló' }, { status: 500 }),
      ),
    )
    await user.type(screen.getByLabelText('Número de documento'), '00112345678')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('No se pudo verificar. Inténtalo de nuevo.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Número de documento'), '9')
    expect(screen.queryByText('No se pudo verificar. Inténtalo de nuevo.')).not.toBeInTheDocument()
  })
})
