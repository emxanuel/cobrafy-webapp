import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { formatDate } from '@/features/shared/lib/format-date'
import { formatMoney } from '@/features/shared/lib/format-money'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { createSale, getSale, listClientSales, listSales } from '@/features/sales/services/requests'
import { businesses, membership, users } from './fixtures'
import { seedSale } from './handlers'
import { renderApp, seedAuth } from './render'
import { server } from './server'
import {
  clientSaleDetailFixture,
  clientSaleFixture,
  handwrittenClientSales,
} from './sales-msw'

function loginCashier() {
  seedAuth({
    user: users.cashier,
    memberships: [membership(users.cashier, businesses.norte, 'cajero')],
    token: 'token-cashier',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

function loginCollector() {
  seedAuth({
    user: users.collector,
    memberships: [membership(users.collector, businesses.norte, 'cobrador')],
    token: 'token-collector',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

function mockClientSales(items: ReturnType<typeof clientSaleFixture>[]) {
  server.use(
    http.get('*/clients/:id/sales', () => HttpResponse.json({ items })),
  )
}

function comprasSection() {
  return screen.getByRole('heading', { name: 'Compras' }).closest('section')!
}

describe('compras del cliente', () => {
  it('mantiene el orden del servidor y no reordena en el cliente', async () => {
    loginCashier()
    mockClientSales([
      clientSaleFixture({
        id: 'sale-10',
        sale_number: 10,
        item_description: 'Primero del servidor',
        created_at: '2026-01-01T16:00:00.000Z',
      }),
      clientSaleFixture({
        id: 'sale-200',
        sale_number: 200,
        item_description: 'Segundo del servidor',
        created_at: '2026-12-01T16:00:00.000Z',
      }),
      clientSaleFixture({
        id: 'sale-5',
        sale_number: 5,
        item_description: 'Tercero del servidor',
        created_at: '2026-06-01T16:00:00.000Z',
      }),
    ])
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    const titles = await screen.findAllByText(/del servidor/)
    expect(titles.map((node) => node.textContent)).toEqual([
      '#10 · Primero del servidor',
      '#200 · Segundo del servidor',
      '#5 · Tercero del servidor',
    ])
    expect(screen.queryByText('Aún no hay compras registradas para este cliente.')).not.toBeInTheDocument()
    expect(screen.getByText('3 activas · 0 anuladas')).toBeInTheDocument()
  })

  it('el vacío solo aparece cuando items es []', async () => {
    loginCashier()
    mockClientSales([])
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(
      await screen.findByText('Aún no hay compras registradas para este cliente.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar la primera venta' })).toHaveAttribute(
      'href',
      '/clientes/cli-1/ventas/nueva',
    )
    expect(screen.queryByText(/activas/)).not.toBeInTheDocument()
  })

  it('con compras no muestra el vacío', async () => {
    loginCashier()
    mockClientSales([clientSaleFixture()])
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    expect(screen.queryByText('Aún no hay compras registradas para este cliente.')).not.toBeInTheDocument()
  })

  it('una venta anulada no muestra saldo y tacha el total', async () => {
    loginCashier()
    mockClientSales(handwrittenClientSales)
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('#117 · Abanico Royal')).toBeInTheDocument()
    const voided = screen.getByText('#117 · Abanico Royal').closest('article')!
    const active = screen.getByText('#128 · Nevera Mabe 14 pies').closest('article')!
    expect(voided).toHaveClass('bg-muted')
    expect(within(voided).getByText('⊘ Anulada')).toBeInTheDocument()
    expect(within(voided).getByText(formatMoney('3600.00'))).toHaveClass('line-through')
    expect(within(voided).queryByText(formatMoney('0.00'))).not.toBeInTheDocument()
    expect(within(active).getByText('● Activa')).toBeInTheDocument()
    expect(within(active).getByText(formatMoney('18000.00'))).not.toHaveClass('line-through')
    expect(within(active).getByText(formatMoney('15000.00'))).toBeInTheDocument()
    expect(within(active).getByText(`Vendida el ${formatDate('2026-10-17T16:00:00.000Z')}`)).toBeInTheDocument()
    expect(screen.getByText('2 activas · 1 anulada')).toBeInTheDocument()
    expect(voided.closest('a')).toBeNull()
    expect(screen.queryByText(/mensuales ×/)).not.toBeInTheDocument()
  })

  it('la ficha muestra las 3 primeras de la respuesta y el enlace al historial', async () => {
    loginCashier()
    mockClientSales([
      clientSaleFixture({ id: 's1', sale_number: 1, item_description: 'Uno' }),
      clientSaleFixture({ id: 's2', sale_number: 2, item_description: 'Dos' }),
      clientSaleFixture({ id: 's3', sale_number: 3, item_description: 'Tres' }),
      clientSaleFixture({ id: 's4', sale_number: 4, item_description: 'Cuatro' }),
    ])
    window.history.pushState({}, '', '/clientes/cli-1')
    renderApp()
    expect(await screen.findByText('#1 · Uno')).toBeInTheDocument()
    expect(screen.getByText('#2 · Dos')).toBeInTheDocument()
    expect(screen.getByText('#3 · Tres')).toBeInTheDocument()
    expect(screen.queryByText('#4 · Cuatro')).not.toBeInTheDocument()
    const all = screen.getByRole('link', { name: 'Ver todas las compras' })
    expect(all).toHaveAttribute('href', '/clientes/cli-1/historial')
    expect(all).toHaveClass('min-h-11')
    expect(screen.queryByText(/activas ·/)).not.toBeInTheDocument()
  })

  it('muestra 2 skeletons al cargar y el error con Reintentar', async () => {
    loginCashier()
    let release: (() => void) | undefined
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    let calls = 0
    server.use(
      http.get('*/clients/:id/sales', async () => {
        calls += 1
        if (calls === 1) {
          await hold
          return HttpResponse.json({ detail: 'falló' }, { status: 500 })
        }
        if (calls === 2) return HttpResponse.json({ detail: 'falló' }, { status: 500 })
        return HttpResponse.json({ items: [clientSaleFixture()] })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    expect(within(comprasSection()).getAllByTestId('sale-card-skeleton')).toHaveLength(2)
    expect(within(comprasSection()).getByText('Cargando…')).toBeInTheDocument()
    expect(screen.queryByText('Aún no hay compras registradas para este cliente.')).not.toBeInTheDocument()
    release?.()
    expect(
      await screen.findByText('No se pudieron cargar las compras.', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Revisa tu conexión e inténtalo de nuevo.')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
  })

  it('el cobrador no ve Nueva venta y solo lista lo que devuelve la API', async () => {
    loginCollector()
    mockClientSales([handwrittenClientSales[0]!])
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrar la primera venta' })).not.toBeInTheDocument()
    expect(screen.queryByText('#121 · Televisor Samsung 50”')).not.toBeInTheDocument()
  })

  it('un cobrador no asignado recibe 404 en las compras', async () => {
    loginCollector()
    window.history.pushState({}, '', '/clientes/cli-unassigned/historial')
    renderApp()
    expect(
      await screen.findByText('Este cliente no existe o ya no está disponible.'),
    ).toBeInTheDocument()
  })

  it('POST 201, GET /sales y GET /sales/{id} incluyen balance requerido', async () => {
    loginCashier()
    const created = await createSale(
      {
        client_id: 'cli-1',
        item_description: 'Radio',
        price: '1000.00',
        down_payment: '0.00',
        installments: 2,
        frequency: 'mensual',
        first_due_date: '2026-11-17',
      },
      '11111111-1111-4111-8111-111111111111',
    )
    expect(created.balance).toMatch(/^\d+\.\d{2}$/)
    expect(created.balance).toBe(created.total)
    const page = await listSales()
    expect(page.items.find((item) => item.id === created.id)?.balance).toBe(created.balance)
    const detail = await getSale(created.id)
    expect(detail.balance).toBe(created.balance)
    expect(detail.installments.length).toBeGreaterThan(0)
    const clientSales = await listClientSales('cli-1')
    expect(clientSales.find((item) => item.id === created.id)?.balance).toBe(created.balance)
  })

  it('las fixtures SaleRead y SaleDetail traen balance escrito a mano', () => {
    expect(clientSaleFixture().balance).toBe('15000.00')
    expect(handwrittenClientSales[2]?.balance).toBe('0.00')
    expect(clientSaleDetailFixture({ status: 'anulada', balance: '0.00' }).balance).toBe('0.00')
    expect(clientSaleDetailFixture().balance).toBe('15000.00')
  })

  it('tras un replay 200 invalida las compras y la venta aparece', async () => {
    loginCashier()
    const replay = {
      ...clientSaleFixture({
        id: 'sale-replay-list',
        sale_number: 88,
        item_description: 'Nevera Mabe 14 pies',
        total: '22200.00',
        balance: '22200.00',
      }),
      installments: [
        {
          number: 1,
          due_date: '2026-11-17',
          amount: '1850.00',
          paid: '0.00',
          late_fee: '0.00',
          status: 'pendiente',
        },
      ],
      contract: {},
      warnings: [],
    }
    let attempt = 0
    server.use(
      http.post('*/sales', async () => {
        attempt += 1
        if (attempt === 1) return HttpResponse.error()
        seedSale(replay)
        return HttpResponse.json(replay, { status: 200 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    const user = userEvent.setup()
    renderApp()
    expect(
      await screen.findByText('Aún no hay compras registradas para este cliente.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Registrar la primera venta' }))
    expect(await screen.findByRole('heading', { name: 'Nueva venta' }, { timeout: 5000 })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Artículo'), 'Nevera Mabe 14 pies')
    await user.type(screen.getByLabelText('Precio'), '18500.00')
    await waitFor(() => expect(screen.getByText('✓ Actualizado')).toBeInTheDocument(), {
      timeout: 5000,
    })
    const confirm = await screen.findByRole('button', { name: 'Confirmar venta' })
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 })
    await user.click(confirm)
    await user.click(await screen.findByRole('button', { name: 'Registrar venta' }))
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Listo, venta #88 registrada.')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Volver al cliente' }))
    expect(await screen.findByText('#88 · Nevera Mabe 14 pies')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Historial' }))
    expect(await screen.findByText('#88 · Nevera Mabe 14 pies')).toBeInTheDocument()
    expect(screen.getAllByText(formatMoney('22200.00')).length).toBeGreaterThan(0)
  })
})
