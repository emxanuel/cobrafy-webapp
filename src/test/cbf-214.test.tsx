import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CREDITS_EMPTY_TITLE } from '@/features/sales/lib/copy'
import { formatMoney } from '@/features/shared/lib/format-money'
import { useBusinessStore } from '@/features/business/stores/business-store'
import type { InstallmentRead, SaleRead } from '@/features/sales/services/types'
import { businesses, membership, users } from './fixtures'
import { seedSale } from './handlers'
import { renderApp, seedAuth } from './render'
import { server } from './server'
import { clientSaleDetailFixture, clientSaleFixture } from './sales-msw'

function loginOwner() {
  seedAuth({
    user: users.owner,
    memberships: [membership(users.owner, businesses.norte, 'dueño')],
    token: 'token-owner',
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

function listInstallments(
  rows: Array<{ status: string; has_payment?: boolean }>,
): SaleRead['installments'] {
  return rows.map((row, index) => ({
    number: index + 1,
    status: row.status,
    ...(row.has_payment !== undefined ? { has_payment: row.has_payment } : {}),
  }))
}

function detailInstallments(
  rows: Array<{ status: string; has_payment?: boolean; amount?: string }>,
): InstallmentRead[] {
  return rows.map((row, index) => ({
    number: index + 1,
    due_date: '2026-11-17',
    amount: row.amount ?? '1500.00',
    paid: '0.00',
    late_fee: '0.00',
    status: row.status,
    ...(row.has_payment !== undefined ? { has_payment: row.has_payment } : {}),
  }))
}

function sale214(overrides: Partial<SaleRead> = {}): SaleRead {
  return clientSaleFixture({
    regular_installment_amount: '1500.00',
    last_installment_amount: '1500.00',
    installments: listInstallments([
      { status: 'paid' },
      { status: 'paid' },
      { status: 'paid' },
      { status: 'partial' },
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
    ]),
    installments_summary: { paid: 3, partial: 1, overdue: 0, pending: 8, cancelled: 0 },
    ...overrides,
  })
}

function cardOf(title: string) {
  return screen.getByText(title).closest('a')!
}

describe('CBF-214 estado real de las cuotas', () => {
  it('la misma tarjeta se pinta en /ventas y en Compras del cliente', async () => {
    loginOwner()
    seedSale(sale214())
    window.history.pushState({}, '', '/ventas')
    renderApp()
    const title = '#128 · Nevera Mabe 14 pies'
    expect(await screen.findByText(title)).toBeInTheDocument()
    const onList = cardOf(title)
    expect(within(onList).getByText('Ana Pérez')).toBeInTheDocument()
    expect(within(onList).getByText('12 mensuales × RD$ 1,500.00')).toBeInTheDocument()
    expect(within(onList).getByText(/3 pagadas/)).toBeInTheDocument()
    expect(within(onList).getByText(/1 parcial/)).toBeInTheDocument()
    expect(within(onList).getByText(/8 pendientes/)).toBeInTheDocument()
    expect(within(onList).getByLabelText('12 cuotas: 3 pagadas, 1 parcial, 8 pendientes')).toBeInTheDocument()

    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText(title)).toBeInTheDocument()
    const onPurchases = cardOf(title)
    expect(within(onPurchases).queryByText('Ana Pérez')).not.toBeInTheDocument()
    expect(within(onPurchases).getByText('12 mensuales × RD$ 1,500.00')).toBeInTheDocument()
    expect(within(onPurchases).getByText(/3 pagadas/)).toBeInTheDocument()
    expect(within(onPurchases).getByText(/1 parcial/)).toBeInTheDocument()
    expect(within(onPurchases).getByText(/8 pendientes/)).toBeInTheDocument()
    expect(
      within(onPurchases).getByLabelText('12 cuotas: 3 pagadas, 1 parcial, 8 pendientes'),
    ).toBeInTheDocument()
  })

  it('el cobrador ve el documento enmascarado, no ve Nueva venta y la tarjeta es igual', async () => {
    loginCollector()
    seedSale(sale214())
    window.history.pushState({}, '', '/clientes/cli-1/historial')
    renderApp()
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    expect(screen.getByText(/Cédula •••-••••567-8/)).toBeInTheDocument()
    expect(screen.queryByText('001-1234567-8')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
    const card = cardOf('#128 · Nevera Mabe 14 pies')
    expect(within(card).getByText('12 mensuales × RD$ 1,500.00')).toBeInTheDocument()
    expect(within(card).getByText(/3 pagadas/)).toBeInTheDocument()
    expect(within(card).queryByText('Ana Pérez')).not.toBeInTheDocument()
  })

  it('backend viejo sin campos nuevos no rompe y cae a lo de hoy', async () => {
    loginOwner()
    seedSale(clientSaleFixture())
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    const card = cardOf('#128 · Nevera Mabe 14 pies')
    expect(within(card).getByText('12 mensuales')).toBeInTheDocument()
    expect(within(card).queryByText(/mensuales ×/)).not.toBeInTheDocument()
    expect(within(card).queryByText(/pagadas/)).not.toBeInTheDocument()
    expect(within(card).getByText(`Saldo ${formatMoney('15000.00')}`)).toBeInTheDocument()
    expect(within(card).getByLabelText('12 cuotas: 12 pendientes')).toBeInTheDocument()
  })

  it('no recalcula el resumen: los números salen de installments_summary', async () => {
    loginOwner()
    seedSale(
      sale214({
        installments: listInstallments(Array.from({ length: 12 }, () => ({ status: 'pending' }))),
        installments_summary: { paid: 3, partial: 1, overdue: 0, pending: 8, cancelled: 0 },
      }),
    )
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    const card = cardOf('#128 · Nevera Mabe 14 pies')
    expect(within(card).getByText(/3 pagadas/)).toBeInTheDocument()
    expect(within(card).getByText(/1 parcial/)).toBeInTheDocument()
    expect(within(card).getByText(/8 pendientes/)).toBeInTheDocument()
    expect(within(card).queryByText(/12 pendientes/)).not.toBeInTheDocument()
    expect(within(card).getByLabelText('12 cuotas: 3 pagadas, 1 parcial, 8 pendientes')).toBeInTheDocument()
  })

  it('Saldada oculta el saldo, anulada no usa created_at y cuota única / última distinta', async () => {
    loginOwner()
    seedSale(
      sale214({
        id: 'sale-125',
        sale_number: 125,
        item_description: 'Celular Galaxy A15',
        installments_count: 24,
        balance: '0.00',
        regular_installment_amount: '1400.00',
        last_installment_amount: '1400.00',
        installments_summary: { paid: 24, partial: 0, overdue: 0, pending: 0, cancelled: 0 },
      }),
    )
    seedSale(
      sale214({
        id: 'sale-117',
        sale_number: 117,
        item_description: 'Abanico Royal',
        status: 'anulada',
        installments_count: 4,
        frequency: 'semanal',
        total: '3600.00',
        balance: '0.00',
        regular_installment_amount: '900.00',
        last_installment_amount: '900.00',
        created_at: '2026-09-28T16:00:00.000Z',
        voided_at: null,
        voided_by: { membership_id: 'mem-owner', name: 'Ana Pérez' },
        installments_summary: { paid: 0, partial: 0, overdue: 0, pending: 0, cancelled: 4 },
      }),
    )
    seedSale(
      sale214({
        id: 'sale-90',
        sale_number: 90,
        item_description: 'Cuota única',
        installments_count: 1,
        regular_installment_amount: '1800.00',
        last_installment_amount: '1800.00',
        installments: listInstallments([{ status: 'pending' }]),
        installments_summary: { paid: 0, partial: 0, overdue: 0, pending: 1, cancelled: 0 },
      }),
    )
    seedSale(
      sale214({
        id: 'sale-127',
        sale_number: 127,
        item_description: 'Estufa Tropical',
        installments_count: 9,
        frequency: 'quincenal',
        regular_installment_amount: '1225.00',
        last_installment_amount: '1228.00',
        installments_summary: { paid: 2, partial: 0, overdue: 2, pending: 5, cancelled: 0 },
      }),
    )
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(await screen.findByText('#125 · Celular Galaxy A15')).toBeInTheDocument()
    const settled = cardOf('#125 · Celular Galaxy A15')
    expect(within(settled).getByText(/Saldada · 24 pagadas/)).toBeInTheDocument()
    expect(within(settled).queryByText(/Saldo/)).not.toBeInTheDocument()
    expect(within(settled).queryByText(formatMoney('0.00'))).not.toBeInTheDocument()

    const voided = cardOf('#117 · Abanico Royal')
    expect(within(voided).getByText('4 semanales × RD$ 900.00')).toBeInTheDocument()
    expect(within(voided).getByText(/4 canceladas/)).toBeInTheDocument()
    expect(within(voided).getByText('Anulada por Ana Pérez')).toBeInTheDocument()
    expect(within(voided).queryByText(/Anulada el 28\/09\/2026/)).not.toBeInTheDocument()
    expect(within(voided).queryByText(/Saldo/)).not.toBeInTheDocument()

    expect(within(cardOf('#90 · Cuota única')).getByText('RD$ 1,800.00')).toBeInTheDocument()
    expect(within(cardOf('#90 · Cuota única')).queryByText(/1 mensual ×/)).not.toBeInTheDocument()
    expect(
      within(cardOf('#127 · Estufa Tropical')).getByText(
        '9 quincenales × RD$ 1,225.00 · última RD$ 1,228.00',
      ),
    ).toBeInTheDocument()
  })

  it('más de 12 cuotas: +N y el resumen cuenta todas', async () => {
    loginOwner()
    seedSale(
      sale214({
        id: 'sale-130',
        sale_number: 130,
        item_description: 'Juego de sala',
        installments_count: 24,
        regular_installment_amount: '1000.00',
        last_installment_amount: '1000.00',
        installments: listInstallments([
          ...Array.from({ length: 6 }, () => ({ status: 'paid' })),
          { status: 'overdue' },
          ...Array.from({ length: 17 }, () => ({ status: 'pending' })),
        ]),
        installments_summary: { paid: 6, partial: 0, overdue: 1, pending: 17, cancelled: 0 },
        balance: '17000.00',
      }),
    )
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(await screen.findByText('#130 · Juego de sala')).toBeInTheDocument()
    const card = cardOf('#130 · Juego de sala')
    expect(within(card).getByText('+12')).toBeInTheDocument()
    expect(within(card).getByText(/6 pagadas/)).toBeInTheDocument()
    expect(within(card).getByText(/1 vencida/)).toBeInTheDocument()
    expect(within(card).getByText(/17 pendientes/)).toBeInTheDocument()
    expect(
      within(card).getByLabelText('24 cuotas: 6 pagadas, 1 vencida, 17 pendientes'),
    ).toBeInTheDocument()
    expect(within(card.querySelector('[role="img"]')!).querySelectorAll(':scope > span')).toHaveLength(13)
  })

  it('el article tiene gap de 6 px y toda la tarjeta es el área táctil', async () => {
    loginOwner()
    seedSale(sale214())
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    const link = cardOf('#128 · Nevera Mabe 14 pies')
    expect(link).toHaveClass('min-h-11')
    expect(link.querySelector('article')).toHaveClass('gap-1.5', 'min-h-11')
  })

  it('cargando muestra skeleton de 4 líneas y el vacío conserva el copy', async () => {
    loginOwner()
    let release: (() => void) | undefined
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('*/sales', async () => {
        await hold
        return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 50 })
      }),
    )
    window.history.pushState({}, '', '/ventas')
    renderApp()
    const skeletons = await screen.findAllByTestId('sale-card-skeleton')
    expect(skeletons).toHaveLength(2)
    expect(skeletons[0]?.children).toHaveLength(4)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    release?.()
    expect(await screen.findByText(CREDITS_EMPTY_TITLE, {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('el error de la lista conserva el copy y Reintentar', async () => {
    loginOwner()
    server.use(
      http.get('*/sales', () => HttpResponse.json({ detail: 'falló' }, { status: 500 })),
    )
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(
      await screen.findByText('No se pudieron cargar las ventas.', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('si falla Ver más conserva la lista y muestra Reintentar', async () => {
    loginOwner()
    let pageTwoCalls = 0
    server.use(
      http.get('*/sales', ({ request }) => {
        const url = new URL(request.url)
        const page = Number(url.searchParams.get('page') ?? '1')
        if (page <= 1) {
          return HttpResponse.json({
            items: [sale214()],
            total: 2,
            page: 1,
            page_size: 1,
          })
        }
        pageTwoCalls += 1
        if (pageTwoCalls === 1) {
          return HttpResponse.json({ detail: 'falló la página' }, { status: 500 })
        }
        return HttpResponse.json({
          items: [sale214({ id: 'sale-121', sale_number: 121, item_description: 'Televisor Samsung 50”' })],
          total: 2,
          page: 2,
          page_size: 1,
        })
      }),
    )
    window.history.pushState({}, '', '/ventas')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver más' }))
    expect(
      await screen.findByText('No pudimos cargar más ventas.', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    expect(screen.queryByText('No se pudieron cargar las ventas.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('#121 · Televisor Samsung 50”', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('detalle: Estado con ícono + palabra nowrap, encabezado con línea resumen, sin línea bajo el monto', async () => {
    loginOwner()
    seedSale(
      clientSaleDetailFixture({
        regular_installment_amount: '1500.00',
        last_installment_amount: '1500.00',
        installments_count: 5,
        installments_summary: { paid: 1, partial: 1, overdue: 1, pending: 1, cancelled: 1 },
        installments: detailInstallments([
          { status: 'paid' },
          { status: 'partial' },
          { status: 'overdue', has_payment: true },
          { status: 'pending', has_payment: true },
          { status: 'cancelled' },
        ]),
      }),
    )
    window.history.pushState({}, '', '/ventas/sale-128')
    renderApp()
    const heading = await screen.findByRole('heading', { name: 'Cuotas' })
    const header = heading.parentElement
    expect(header).not.toBeNull()
    expect(within(header as HTMLElement).getByText(/1 pagada/)).toBeInTheDocument()
    expect(within(header as HTMLElement).getByText(/1 parcial/)).toBeInTheDocument()
    expect(within(header as HTMLElement).getByText(/1 vencida/)).toBeInTheDocument()
    expect(within(header as HTMLElement).getByText(/1 pendiente/)).toBeInTheDocument()
    expect(within(header as HTMLElement).queryByText('Pagada')).not.toBeInTheDocument()
    expect(within(header as HTMLElement).queryByText('3 de 5 pagadas')).not.toBeInTheDocument()

    const table = screen.getByRole('table')
    expect(within(table).getByLabelText('Pagada')).toBeInTheDocument()
    expect(within(table).getByLabelText('Parcial')).toBeInTheDocument()
    expect(within(table).getByLabelText('Vencida · abonada')).toBeInTheDocument()
    expect(within(table).getByLabelText('Pendiente · abonada')).toBeInTheDocument()
    expect(within(table).getByLabelText('Cancelada')).toBeInTheDocument()
    expect(within(table).getByLabelText('Vencida · abonada').closest('td')).toHaveClass(
      'whitespace-nowrap',
    )
    expect(screen.queryByText(/Pagado RD\$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mora abonada/)).not.toBeInTheDocument()
  })

  it('el total no se parte y el article ordena puntos, resumen, vendida y saldo', async () => {
    loginOwner()
    seedSale(sale214({ balance: '17500.00' }))
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    const card = cardOf('#128 · Nevera Mabe 14 pies')
    const total = within(card).getByText(formatMoney('18000.00'))
    expect(total).toHaveClass('whitespace-nowrap')
    const article = card.querySelector('article')!
    const text = article.textContent ?? ''
    expect(text.indexOf('RD$ 18,000.00')).toBeLessThan(text.indexOf('3 pagadas'))
    expect(text.indexOf('3 pagadas')).toBeLessThan(text.indexOf('Vendida el'))
    expect(text.indexOf('Vendida el')).toBeLessThan(text.indexOf('Saldo'))
  })
})

describe('CBF-214 espera de carga', () => {
  it('el skeleton no se queda si la lista responde', async () => {
    loginOwner()
    seedSale(sale214())
    server.use(
      http.get('*/sales', async () => {
        await delay(20)
        return HttpResponse.json({
          items: [sale214()],
          total: 1,
          page: 1,
          page_size: 50,
        })
      }),
    )
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(await screen.findByTestId('sale-card-skeleton')).toBeInTheDocument()
    await waitFor(
      () => {
        expect(screen.queryByTestId('sale-card-skeleton')).not.toBeInTheDocument()
      },
      { timeout: 4000 },
    )
    expect(screen.getByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
  })
})
