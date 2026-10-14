import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { users } from './fixtures'
import { auditRequests } from './handlers'
import { renderApp } from './render'
import { server } from './server'

async function loginAs(email: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Correo'), email)
  await user.type(screen.getByLabelText('Contraseña'), 'secreto123')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('bitácora', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('el cajero no ve Bitácora y en /auditoria recibe No autorizado', async () => {
    renderApp()
    await loginAs(users.cashier.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Menú' }))
    expect(screen.queryByRole('link', { name: 'Bitácora' })).not.toBeInTheDocument()

    cleanup()
    window.history.pushState({}, '', '/auditoria')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'No autorizado' })).toBeInTheDocument()
    expect(screen.getByText('Solo el dueño del negocio puede ver la bitácora.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a clientes' })).toBeInTheDocument()
  })

  it('el cobrador no ve Bitácora y en /auditoria recibe No autorizado', async () => {
    renderApp()
    await loginAs(users.collector.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Menú' }))
    expect(screen.queryByRole('link', { name: 'Bitácora' })).not.toBeInTheDocument()

    cleanup()
    window.history.pushState({}, '', '/auditoria')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'No autorizado' })).toBeInTheDocument()
  })

  it('el dueño filtra, pagina y ve el documento enmascarado', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.owner.email)
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    await user.click(screen.getByRole('link', { name: 'Bitácora' }))

    expect(await screen.findByRole('heading', { name: 'Bitácora' })).toBeInTheDocument()
    expect(await screen.findByText('Cliente bloqueado')).toBeInTheDocument()
    expect(screen.getByText(/Mostrando 1–20 de 25 eventos/)).toBeInTheDocument()

    const edited = screen.getAllByText('Cliente editado')[0]?.closest('li')
    expect(edited).toBeTruthy()
    await user.click(within(edited as HTMLElement).getByText('Ver cambios'))
    expect(within(edited as HTMLElement).getByText('•••-••••567-8')).toBeInTheDocument()
    expect(within(edited as HTMLElement).queryByText('001-1234567-8')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Siguiente ›' }))
    expect(await screen.findByText(/Página 2/)).toBeInTheDocument()
    expect(window.location.search).toContain('page=2')
    expect(screen.getByRole('button', { name: 'Siguiente ›' })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Entidad'), 'client')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => {
      expect(window.location.search).toContain('entity=client')
      expect(window.location.search).toContain('page=1')
    })
    expect(auditRequests.some((req) => req.url.includes('entity=client'))).toBe(true)
  })

  it('muestra vacío, error y reintento', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.owner.email)
    cleanup()

    server.use(
      http.get('*/audit', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 }),
      ),
    )
    window.history.pushState({}, '', '/auditoria?entity=contact')
    renderApp()
    expect(await screen.findByText('No hay eventos con estos filtros')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => {
      expect(window.location.search).toBe('')
    })

    cleanup()
    server.use(
      http.get('*/audit', () =>
        HttpResponse.json({ detail: 'falló' }, { status: 500 }),
      ),
    )
    window.history.pushState({}, '', '/auditoria')
    renderApp()
    expect(
      await screen.findByText('No se pudo cargar la bitácora. Revisa tu conexión e inténtalo de nuevo.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('valida el rango de fechas', async () => {
    const user = userEvent.setup()
    renderApp()
    await loginAs(users.owner.email)
    cleanup()
    window.history.pushState({}, '', '/auditoria')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Bitácora' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Desde'), '2026-10-14')
    await user.type(screen.getByLabelText('Hasta'), '2026-10-01')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(
      screen.getByText('La fecha final debe ser igual o posterior a la inicial.'),
    ).toBeInTheDocument()
  })
})
