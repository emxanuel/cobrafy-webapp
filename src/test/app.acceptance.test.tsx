import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clientKeys } from '@/features/clients/query-keys'
import { getQueryClient } from '@/query-client'
import { renderApp } from './render'
import {
  clientDetailRequests,
  contactWrites,
  logoutRequests,
  memberWrites,
  searchRequests,
} from './handlers'
import { server } from './server'
import { businesses, cashierMember, users } from './fixtures'

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

  it('Salir borra todas las cobrafy.pendingSale:*', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    sessionStorage.setItem(
      'cobrafy.pendingSale:cli-1',
      JSON.stringify({ key: 'pending-1', payload: {}, snapshot: {} }),
    )
    sessionStorage.setItem(
      'cobrafy.pendingSale:cli-2',
      JSON.stringify({ key: 'pending-2', payload: {}, snapshot: {} }),
    )
    sessionStorage.setItem(
      'cobrafy.saleIdempotency:nevera|18500.00',
      JSON.stringify({ key: 'idemp-1' }),
    )
    await user.click(screen.getByRole('button', { name: 'Salir' }))
    expect(await screen.findByRole('heading', { name: 'Entra a tu negocio' })).toBeInTheDocument()
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeNull()
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-2')).toBeNull()
    expect(sessionStorage.getItem('cobrafy.saleIdempotency:nevera|18500.00')).toBeNull()
  })

  it('cambiar de negocio limpia la caché de TanStack Query', async () => {
    const user = userEvent.setup()
    const clear = vi.spyOn(getQueryClient(), 'clear')
    renderApp()
    await loginAs(users.multi.email)
    await user.click(await screen.findByRole('button', { name: /Créditos Norte/ }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()

    clear.mockClear()
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    await user.click(screen.getByRole('button', { name: /Créditos Sur/ }))
    expect(clear).toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Entra a tu negocio' })).not.toBeInTheDocument()
    expect(await screen.findByText('Sofía Sur')).toBeInTheDocument()
  })

  it('cambiar de negocio desde el menú no cierra la sesión aunque el token viejo ya no sirva', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.multi.email)
    await user.click(await screen.findByRole('button', { name: /Créditos Norte/ }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Menú' }))
    await user.click(screen.getByRole('button', { name: /Créditos Sur/ }))

    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Entra a tu negocio' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/clientes')
    expect(screen.getAllByText('Créditos Sur').length).toBeGreaterThan(0)
    expect(await screen.findByText('Sofía Sur')).toBeInTheDocument()
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

  it('el 422 de cédula (field null) va al banner; el 409 de documento va al campo', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    await user.click(await screen.findByRole('link', { name: 'Nuevo cliente' }))

    await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez')
    await user.type(screen.getByLabelText('Número de documento'), 'malo')
    await user.type(screen.getByLabelText('Teléfono'), '8095551111')
    await user.type(screen.getByLabelText('Dirección'), 'Calle 1')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    const cedulaBanner = await screen.findByText('Cédula inválida')
    expect(cedulaBanner.closest('[role="alert"]')).toBeTruthy()
    expect(document.getElementById('document-error')).toBeNull()
    expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('aria-invalid')

    await user.clear(screen.getByLabelText('Número de documento'))
    await user.type(screen.getByLabelText('Número de documento'), 'duplicado')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    expect(
      await screen.findByText('Ya existe un cliente con este documento'),
    ).toBeInTheDocument()
    expect(document.getElementById('document-error')).toHaveTextContent(
      'Ya existe un cliente con este documento',
    )
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
    getQueryClient().clear()
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

  it('un 401 y un login nuevo no dejan ver los datos del usuario anterior', async () => {
    renderApp()
    await loginAs(users.cashier.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()

    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    expect(
      getQueryClient().getQueryData(clientKeys.detail(businesses.norte.id, 'cli-1')),
    ).toBeTruthy()

    server.use(
      http.get('*/auth/me', () =>
        HttpResponse.json({ detail: 'no autenticado' }, { status: 401 }),
      ),
      http.get('*/clients/:id', () =>
        HttpResponse.json({ detail: 'no autenticado' }, { status: 401 }),
      ),
      http.get('*/clients', () =>
        HttpResponse.json({ detail: 'no autenticado' }, { status: 401 }),
      ),
    )
    await getQueryClient().invalidateQueries()
    expect(await screen.findByRole('heading', { name: 'Entra a tu negocio' })).toBeInTheDocument()
    await waitFor(() => {
      expect(getQueryClient().getQueryCache().getAll()).toHaveLength(0)
    })

    server.resetHandlers()
    await loginAs(users.owner.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(
      getQueryClient().getQueryData(clientKeys.detail(businesses.norte.id, 'cli-1')),
    ).toBeUndefined()
    expect(screen.queryByRole('heading', { name: 'Ana Pérez' })).not.toBeInTheDocument()
    expect(
      getQueryClient()
        .getQueryCache()
        .getAll()
        .every((entry) => {
          const data = entry.state.data as { name?: string; items?: Array<{ name?: string }> } | undefined
          if (!data) return true
          if (data.name === 'Ana Pérez') return false
          return !data.items?.some((item) => item.name === 'Ana Pérez')
        }),
    ).toBe(true)
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

  it('si el PIN se bloquea cierra la sesión y manda al login', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.pin.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()

    cleanup()
    window.history.pushState({}, '', '/clientes')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Clave rápida' })).toBeInTheDocument()
    sessionStorage.setItem(
      'cobrafy.saleIdempotency:nevera|18500.00',
      JSON.stringify({ key: 'idemp-pin' }),
    )
    await user.type(screen.getByLabelText('Clave rápida'), '0000')
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await user.click(screen.getByRole('button', { name: 'Continuar' }))
      if (attempt < 4) {
        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
        })
      }
    }
    expect(await screen.findByRole('heading', { name: 'Entra a tu negocio' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Demasiados intentos con la clave rápida. Entra con tu correo y contraseña.',
      ),
    ).toBeInTheDocument()
    expect(sessionStorage.getItem('cobrafy.session')).toBeNull()
    expect(sessionStorage.getItem('cobrafy.saleIdempotency:nevera|18500.00')).toBeNull()
    expect(window.location.pathname).toBe('/login')
    expect(logoutRequests.some((item) => item.token?.includes('token-pin'))).toBe(true)
  })

  it('acepta la invitación pegando el enlace si no hay token en la ruta', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/invitar')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Únete al negocio' })).toBeInTheDocument()
    await user.type(
      screen.getByLabelText('Enlace o código de invitación'),
      'https://app.local/invitar/inv-ok',
    )
    await user.type(screen.getByLabelText('Nombre'), 'Nora Nueva')
    await user.type(screen.getByLabelText('Tu contraseña'), 'clavesegura')
    await user.type(screen.getByLabelText('Repite la contraseña'), 'clavesegura')
    await user.click(screen.getByRole('button', { name: 'Aceptar invitación' }))
    expect(await screen.findByRole('heading', { name: 'Entra a tu negocio' })).toBeInTheDocument()
  })

  it('un cajero que abre /equipo vuelve a clientes', async () => {
    renderApp()
    await loginAs(users.cashier.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    cleanup()
    window.history.pushState({}, '', '/equipo')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Equipo' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/clientes')
  })

  it('un cobrador que abre /clientes/nuevo vuelve a clientes', async () => {
    renderApp()
    await loginAs(users.collector.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    cleanup()
    window.history.pushState({}, '', '/clientes/nuevo')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nuevo cliente' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/clientes')
  })

  it('al cambiar de negocio no vuelve a pedir el cliente abierto del anterior', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.multi.email)
    await user.click(await screen.findByRole('button', { name: /Créditos Norte/ }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    clientDetailRequests.length = 0
    const tokensAfterClear: string[] = []
    let cleared = false
    const client = getQueryClient()
    const originalClear = client.clear.bind(client)
    const clearSpy = vi.spyOn(client, 'clear').mockImplementation(() => {
      originalClear()
      cleared = true
    })
    const onRequest = ({ request }: { request: Request }) => {
      if (!cleared) return
      tokensAfterClear.push(request.headers.get('Authorization') ?? '')
    }
    server.events.on('request:start', onRequest)
    try {
      await user.click(screen.getByRole('button', { name: 'Menú' }))
      await user.click(screen.getByRole('button', { name: /Créditos Sur/ }))
      expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/clientes')
      expect(clientDetailRequests.some((item) => item.id === 'cli-1')).toBe(false)
      expect(tokensAfterClear.every((token) => !token.includes('norte'))).toBe(true)
      expect(await screen.findByText('Sofía Sur')).toBeInTheDocument()
    } finally {
      server.events.removeListener('request:start', onRequest)
      clearSpy.mockRestore()
    }
  })

  it('el dueño cambia el rol de un miembro', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.owner.email)
    cleanup()
    window.history.pushState({}, '', '/equipo')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Equipo' })).toBeInTheDocument()
    const roleSelect = await screen.findByLabelText('Rol de Carla Caja')
    await user.selectOptions(roleSelect, 'cobrador')
    await waitFor(() => {
      expect(roleSelect).toHaveValue('cobrador')
    })
    expect(memberWrites.at(-1)?.body).toEqual({ role: 'cobrador' })
    expect(memberWrites.at(-1)?.body).not.toHaveProperty('name')
  })

  it('el aviso de contactos fallidos se quita del sessionStorage al leerlo', async () => {
    renderApp()
    await loginAs(users.cashier.email)
    cleanup()
    sessionStorage.setItem(
      'cobrafy.failedContacts',
      JSON.stringify([{ name: 'Pedro Gómez', op: 'add' }]),
    )
    window.history.pushState({}, '', '/clientes/cli-1')
    renderApp()
    expect(await screen.findByText(/No se pudo agregar a Pedro Gómez/)).toBeInTheDocument()
    await waitFor(() => {
      expect(sessionStorage.getItem('cobrafy.failedContacts')).toBeNull()
    })
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    expect(screen.queryByText(/No se pudo agregar a Pedro Gómez/)).not.toBeInTheDocument()
  })

  it('en editar, un garante nuevo se manda por POST /contacts', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1/editar')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Editar cliente' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Agregar garante' }))
    const garante = screen.getByRole('group', { name: /Garante / })
    await user.type(within(garante).getByLabelText('Nombre'), 'Pedro Gómez')
    await user.type(within(garante).getByLabelText('Teléfono'), '8095552222')
    await user.type(within(garante).getByLabelText('Relación'), 'Hermano')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    expect(
      contactWrites.some((item) => {
        const body = item.body as { type?: string; name?: string } | null
        return item.method === 'POST' && body?.type === 'garante' && body.name === 'Pedro Gómez'
      }),
    ).toBe(true)
  })

  it('después de un 401, un login en otro negocio no reusa la ficha anterior', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.cashier.email)
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()

    server.use(
      http.get('*/auth/me', () =>
        HttpResponse.json({ detail: 'no autenticado' }, { status: 401 }),
      ),
      http.get('*/clients/:id', () =>
        HttpResponse.json({ detail: 'no autenticado' }, { status: 401 }),
      ),
      http.get('*/clients', () =>
        HttpResponse.json({ detail: 'no autenticado' }, { status: 401 }),
      ),
    )
    await getQueryClient().invalidateQueries()
    expect(await screen.findByRole('heading', { name: 'Entra a tu negocio' })).toBeInTheDocument()
    await waitFor(() => {
      expect(getQueryClient().getQueryCache().getAll()).toHaveLength(0)
    })

    server.resetHandlers()
    await loginAs(users.multi.email)
    await user.click(await screen.findByRole('button', { name: /Créditos Sur/ }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(
      getQueryClient().getQueryData(clientKeys.detail(businesses.norte.id, 'cli-1')),
    ).toBeUndefined()
    expect(screen.queryByRole('heading', { name: 'Ana Pérez' })).not.toBeInTheDocument()
  })

  it('el dueño ve el nombre de quien actuó en el historial, no el id', async () => {
    renderApp()
    await loginAs(users.owner.email)
    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('Bloqueo')).toBeInTheDocument()
    expect(await screen.findByText(/Carla Caja/)).toBeInTheDocument()
    expect(screen.queryByText(cashierMember.id)).not.toBeInTheDocument()
  })
})
