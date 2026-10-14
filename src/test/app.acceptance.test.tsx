import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryClient } from '@/query-client'
import { renderApp } from './render'
import { searchRequests } from './handlers'
import { server } from './server'
import { users } from './fixtures'

async function loginAs(email: string, password = 'secreto123') {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Correo'), email)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('CBF-110 aceptación', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('un cajero crea un cliente completo con garante', async () => {
    const user = userEvent.setup()
    renderApp()

    await loginAs(users.cashier.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Nuevo cliente' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez')
    await user.type(screen.getByLabelText('Número de documento'), '001-1234567-8')
    await user.type(screen.getByLabelText('Teléfono'), '8095551111')
    await user.type(screen.getByLabelText('Dirección'), 'Calle 1')

    await user.click(screen.getByRole('button', { name: 'Agregar garante' }))
    const garante = screen.getByRole('group', { name: /Garante 1/ })
    await user.type(within(garante).getByLabelText('Nombre'), 'Pedro Gómez')
    await user.type(within(garante).getByLabelText('Teléfono'), '8095552222')
    await user.type(within(garante).getByLabelText('Relación'), 'Hermano')
    await user.type(within(garante).getByLabelText('Número de documento (opcional)'), '001-7654321-0')

    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    expect(screen.getByText(/Pedro Gómez/)).toBeInTheDocument()
    expect(sessionStorage.getItem('cobrafy.session')).toBeTruthy()
    expect(localStorage.getItem('cobrafy.session')).toBeNull()
  })

  it('con un negocio entra directo; con varios muestra el selector', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Elige el negocio' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salir' }))
    expect(await screen.findByRole('heading', { name: 'Entra a tu negocio' })).toBeInTheDocument()

    await loginAs(users.multi.email)
    expect(await screen.findByRole('heading', { name: 'Elige el negocio' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Créditos Norte/ }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
  })

  it('cambiar de negocio limpia la caché de TanStack Query', async () => {
    const user = userEvent.setup()
    const clear = vi.spyOn(queryClient, 'clear')
    renderApp()
    await loginAs(users.multi.email)
    await user.click(await screen.findByRole('button', { name: /Créditos Norte/ }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()

    clear.mockClear()
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    await user.click(screen.getByRole('button', { name: /Créditos Sur/ }))
    expect(clear).toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
  })

  it('el menú oculta opciones que el rol no puede usar y un 403 se muestra con calma', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Menú' }))
    expect(screen.queryByRole('link', { name: 'Equipo' })).not.toBeInTheDocument()

    cleanup()
    window.history.pushState({}, '', '/clientes/cli-blocked')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Luis Bloqueado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desbloquear' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Bloqueado')
  })

  it('el dueño ve Desbloquear; si la API responde 403 se avisa', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.owner.email)
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-blocked')
    renderApp()
    expect(await screen.findByRole('button', { name: 'Desbloquear' })).toBeInTheDocument()

    server.use(
      http.post('*/clients/:id/unblock', () =>
        HttpResponse.json({ detail: 'no autorizado' }, { status: 403 }),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))
    await user.type(screen.getByLabelText('Motivo del desbloqueo'), 'pagó la deuda')
    await user.click(screen.getByRole('button', { name: 'Confirmar desbloqueo' }))
    expect(await screen.findByText('No tienes permiso para desbloquear.')).toBeInTheDocument()
  })

  it('errores 422 y 409 se muestran en el campo del documento', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    await user.click(await screen.findByRole('link', { name: 'Nuevo cliente' }))

    await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez')
    await user.type(screen.getByLabelText('Número de documento'), 'malo')
    await user.type(screen.getByLabelText('Teléfono'), '8095551111')
    await user.type(screen.getByLabelText('Dirección'), 'Calle 1')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    expect(
      await screen.findByText('El formato de la cédula no es válido.'),
    ).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Número de documento'))
    await user.type(screen.getByLabelText('Número de documento'), 'duplicado')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    expect(
      await screen.findByText('ya existe un cliente con este documento'),
    ).toBeInTheDocument()
  })

  it('una sesión 401 redirige al login', async () => {
    renderApp()
    await loginAs(users.cashier.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()

    server.use(
      http.get('*/clients', () =>
        HttpResponse.json({ detail: 'no autenticado' }, { status: 401 }),
      ),
    )
    queryClient.clear()
    cleanup()
    window.history.pushState({}, '', '/clientes')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Entra a tu negocio' })).toBeInTheDocument()
  })

  it('muestra el vacío Aún no tienes clientes…', async () => {
    renderApp()
    await loginAs(users.cashier.email)
    expect(await screen.findByTestId('clients-empty')).toHaveTextContent(
      'Aún no tienes clientes…',
    )
  })

  it('la búsqueda va por POST /clients/search y no pone el documento en la URL', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    await screen.findByRole('heading', { name: 'Clientes' })
    await user.type(screen.getByPlaceholderText('Nombre o documento'), '001-1234567-8')

    await waitFor(() => {
      expect(searchRequests.some((req) => req.method === 'POST')).toBe(true)
    })
    expect(window.location.pathname).toBe('/clientes')
    expect(window.location.search).not.toContain('001-1234567-8')
    expect(searchRequests.some((req) => req.url.includes('001-1234567-8'))).toBe(false)
    expect(searchRequests.some((req) => {
      const body = req.body as { q?: string; query?: string; document?: string }
      return body.q === '001-1234567-8' && body.query === undefined
    })).toBe(true)
  })

  it('un cobrador ve el documento enmascarado tal como lo manda la API', async () => {
    renderApp()
    await loginAs(users.collector.email)
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-masked')
    renderApp()
    expect(await screen.findByText(/001-\*\*\*\*\*1234/)).toBeInTheDocument()
    expect(screen.queryByText('001-1234567-8')).not.toBeInTheDocument()
  })

  it('acepta una invitación y deja que el invitado ponga su contraseña', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/invitar/inv-ok')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Únete al negocio' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña del dueño')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Nombre'), 'Nora Nueva')
    await user.type(screen.getByLabelText('Tu contraseña'), 'clavesegura')
    await user.type(screen.getByLabelText('Repite la contraseña'), 'clavesegura')
    await user.click(screen.getByRole('button', { name: 'Aceptar invitación' }))
    expect(await screen.findByRole('heading', { name: 'Entra a tu negocio' })).toBeInTheDocument()
    expect(
      screen.getByText('Listo. Entra con tu correo y la contraseña que acabas de crear.'),
    ).toBeInTheDocument()
  })

  it('el PIN no sustituye el primer login; al reabrir pide la clave rápida', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.pin.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()

    cleanup()
    window.history.pushState({}, '', '/clientes')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Clave rápida' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Clave rápida'), '1234')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
  })
})
