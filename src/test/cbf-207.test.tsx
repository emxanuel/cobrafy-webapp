import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useBusinessStore } from '@/features/business/stores/business-store'
import { formatMoney } from '@/features/shared/lib/format-money'
import { MUTATION_TIMEOUT_MS, UNCONFIRMED_MUTATION_MESSAGE } from '@/features/shared/services/client'
import {
  createSale,
  downloadSaleContract,
  getCreditSettings,
  putCreditSettings,
  toCreditSettingsWrite,
} from '@/features/sales/services/requests'
import { isApiError } from '@/features/shared/lib/api-error'
import { api } from '@/features/shared/services/client'
import { resetAppQueryClient } from '@/query-client'
import { businesses, membership, users } from './fixtures'
import {
  CORS_EXPOSE_HEADERS,
  creditSettingsWrites,
  seedBusinessRecord,
  seedCreditSettings,
  seedSale,
} from './handlers'
import { renderApp, seedAuth } from './render'
import { server } from './server'
import {
  clientSaleDetailFixture,
  clientSaleFixture,
  voidedSaleDetailFixture,
} from './sales-msw'

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

function loginCollector() {
  seedAuth({
    user: users.collector,
    memberships: [membership(users.collector, businesses.norte, 'cobrador')],
    token: 'token-collector',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

function oddCentsSale() {
  return clientSaleDetailFixture({
    id: 'sale-cents',
    sale_number: 90,
    item_description: 'Televisor Samsung 50”',
    total: '11250.00',
    balance: '11250.00',
    surcharge_percent: '12.5',
    installments: [
      {
        number: 1,
        due_date: '2026-11-17',
        amount: '1607.14',
        paid: '0.00',
        late_fee: '0.00',
        status: 'pending',
      },
    ],
  })
}

function paidSale() {
  return clientSaleDetailFixture({
    id: 'sale-paid',
    sale_number: 91,
    installments: [
      {
        number: 1,
        due_date: '2026-11-17',
        amount: '1500.00',
        paid: '100.00',
        late_fee: '0.00',
        status: 'partial',
      },
    ],
  })
}

async function openVoidSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Anular venta' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
}

describe('CBF-207 detalle, contrato, anulación y crédito', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.history.pushState({}, '', '/')
  })

  it('una venta anulada muestra motivo, quién, fecha, Cancelada en cada cuota y el balance 0.00', async () => {
    loginOwner()
    seedSale(voidedSaleDetailFixture())
    window.history.pushState({}, '', '/ventas/sale-117')
    renderApp()
    expect(await screen.findByText('⊘ Venta anulada')).toBeInTheDocument()
    expect(screen.getByText(/Se registró con el precio equivocado/)).toBeInTheDocument()
    expect(screen.getByText(/Anulada por Ana Pérez/)).toBeInTheDocument()
    expect(screen.getByLabelText('4 cuotas canceladas')).toBeInTheDocument()
    expect(screen.getAllByText('Cancelada')).toHaveLength(5)
    expect(screen.getAllByText(formatMoney('0.00')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Anular venta' })).not.toBeInTheDocument()
  })

  it('el cajero no ve Anular y el cobrador no ve Contrato', async () => {
    loginCashier()
    seedSale(clientSaleDetailFixture())
    window.history.pushState({}, '', '/ventas/sale-128')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Venta #128' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '⬇ Descargar contrato' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular venta' })).not.toBeInTheDocument()

    cleanup()
    loginCollector()
    window.history.pushState({}, '', '/ventas/sale-128')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Venta #128' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Descargar contrato/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular venta' })).not.toBeInTheDocument()
  })

  it('si alguna cuota tiene paid distinto de 0.00 no aparece Anular, y un 409 SALE_HAS_PAYMENTS cierra la hoja y refresca', async () => {
    loginOwner()
    seedSale(paidSale())
    window.history.pushState({}, '', '/ventas/sale-paid')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Venta #91' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular venta' })).not.toBeInTheDocument()

    cleanup()
    const unpaid = clientSaleDetailFixture({ id: 'sale-unpaid', sale_number: 92 })
    seedSale(unpaid)
    window.history.pushState({}, '', '/ventas/sale-unpaid')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('button', { name: 'Anular venta' })).toBeInTheDocument()
    server.use(
      http.post('*/sales/:id/void', () =>
        HttpResponse.json(
          {
            detail: [
              {
                field: null,
                code: 'SALE_HAS_PAYMENTS',
                message: 'no se puede anular una venta con pagos',
              },
            ],
          },
          { status: 409 },
        ),
      ),
      http.get('*/sales/:id', () => HttpResponse.json(paidSale())),
    )
    await openVoidSheet(user)
    await user.type(
      screen.getByLabelText('Motivo de la anulación'),
      'Se registró con el precio equivocado.',
    )
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anular venta' }))
    expect(await screen.findByText('No se puede anular: la venta ya tiene pagos.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular venta' })).not.toBeInTheDocument()
  })

  it('muestra 1607.14 y 12.5 % tal cual, y el PUT de crédito manda strings', async () => {
    loginOwner()
    seedSale(oddCentsSale())
    window.history.pushState({}, '', '/ventas/sale-cents')
    renderApp()
    expect((await screen.findAllByText(formatMoney('1607.14'))).length).toBeGreaterThan(0)
    expect(screen.getByText('Recargo (12.5 %)')).toBeInTheDocument()

    cleanup()
    await resetAppQueryClient()
    window.history.pushState({}, '', '/negocio')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Negocio' })).toBeInTheDocument()
    const user = userEvent.setup()
    const percent = screen.getByLabelText('Recargo')
    await user.clear(percent)
    await user.type(percent, '12.50')
    await user.click(screen.getByRole('button', { name: 'Guardar crédito' }))
    await waitFor(() => expect(creditSettingsWrites.length).toBeGreaterThan(0))
    const body = creditSettingsWrites.at(-1)?.body as Record<string, unknown>
    expect(typeof body.surcharge_percent).toBe('string')
    expect(body.surcharge_percent).toBe('12.50')
    expect(body).not.toHaveProperty('configured')
  })

  it('el PUT de crédito no manda configured aunque el GET lo traiga', async () => {
    loginOwner()
    const settings = await getCreditSettings(businesses.norte.id)
    expect(settings.configured).toBe(true)
    expect(toCreditSettingsWrite(settings)).not.toHaveProperty('configured')
    await putCreditSettings(businesses.norte.id, { ...settings, configured: true })
    const body = creditSettingsWrites.at(-1)?.body as Record<string, unknown>
    expect(body).not.toHaveProperty('configured')
    expect(Object.keys(body).sort()).toEqual(
      [
        'allowed_frequencies',
        'interest_method',
        'max_installments',
        'min_down_payment_percent',
        'surcharge_amount',
        'surcharge_kind',
        'surcharge_percent',
      ].sort(),
    )
  })

  it('el vacío de /ventas usa el texto exacto de la AC3', async () => {
    loginOwner()
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(
      await screen.findByText(
        'Aún no tienes ventas a crédito. Registra la primera y empieza a ver tu cartera.',
      ),
    ).toBeInTheDocument()
  })

  it('un 409 SALE_ALREADY_VOIDED se toma como éxito', async () => {
    loginOwner()
    seedSale(clientSaleDetailFixture())
    const voided = voidedSaleDetailFixture({
      id: 'sale-128',
      sale_number: 128,
      item_description: 'Nevera Mabe 14 pies',
    })
    let voidPosted = false
    server.use(
      http.post('*/sales/:id/void', () => {
        voidPosted = true
        return HttpResponse.json(
          {
            detail: [
              { field: null, code: 'SALE_ALREADY_VOIDED', message: 'esta venta ya está anulada' },
            ],
          },
          { status: 409 },
        )
      }),
      http.get('*/sales/:id', () =>
        HttpResponse.json(voidPosted ? voided : clientSaleDetailFixture()),
      ),
    )
    window.history.pushState({}, '', '/ventas/sale-128')
    const user = userEvent.setup()
    renderApp()
    await openVoidSheet(user)
    await user.type(
      screen.getByLabelText('Motivo de la anulación'),
      'Se registró con el precio equivocado.',
    )
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anular venta' }))
    expect(await screen.findByText('Venta #128 anulada.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('⊘ Venta anulada')).toBeInTheDocument()
  })

  it('un timeout al anular seguido de venta anulada cierra con éxito y no reintenta solo', async () => {
    loginOwner()
    seedSale(clientSaleDetailFixture())
    const voided = voidedSaleDetailFixture({
      id: 'sale-128',
      sale_number: 128,
      item_description: 'Nevera Mabe 14 pies',
    })
    let voidCalls = 0
    server.use(
      http.post('*/sales/:id/void', async () => {
        voidCalls += 1
        await delay('infinite')
        return HttpResponse.json(voided)
      }),
      http.get('*/sales/:id', () =>
        HttpResponse.json(voidCalls > 0 ? voided : clientSaleDetailFixture()),
      ),
    )
    window.history.pushState({}, '', '/ventas/sale-128')
    const user = userEvent.setup()
    renderApp()
    await openVoidSheet(user)
    await user.type(
      screen.getByLabelText('Motivo de la anulación'),
      'Se registró con el precio equivocado.',
    )
    vi.useFakeTimers()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anular venta' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MUTATION_TIMEOUT_MS)
    })
    vi.useRealTimers()
    expect(await screen.findByText('Venta #128 anulada.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(voidCalls).toBe(1)
  })

  it('un timeout al anular seguido de venta activa deja la hoja y permite reintentar', async () => {
    loginOwner()
    const active = clientSaleDetailFixture()
    seedSale(active)
    const voided = voidedSaleDetailFixture({
      id: 'sale-128',
      sale_number: 128,
      item_description: 'Nevera Mabe 14 pies',
    })
    let voidCalls = 0
    server.use(
      http.post('*/sales/:id/void', async () => {
        voidCalls += 1
        if (voidCalls === 1) {
          await delay('infinite')
        }
        return HttpResponse.json(voided)
      }),
    )
    window.history.pushState({}, '', '/ventas/sale-128')
    const user = userEvent.setup()
    renderApp()
    await openVoidSheet(user)
    const reason = screen.getByLabelText('Motivo de la anulación')
    await user.type(reason, 'Se registró con el precio equivocado.')
    vi.useFakeTimers()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anular venta' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MUTATION_TIMEOUT_MS)
    })
    vi.useRealTimers()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo de la anulación')).toHaveValue(
      'Se registró con el precio equivocado.',
    )
    const retry = await waitFor(
      () => {
        const button = within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Anular venta',
        })
        expect(button).toBeEnabled()
        return button
      },
      { timeout: 4000 },
    )
    expect(voidCalls).toBe(1)
    await user.click(retry)
    expect(await screen.findByText('Venta #128 anulada.')).toBeInTheDocument()
    expect(voidCalls).toBe(2)
  })

  it('un timeout al crear cliente muestra el aviso y no reintenta', async () => {
    loginCashier()
    let creates = 0
    server.use(
      http.post('*/clients', async () => {
        creates += 1
        await delay('infinite')
        return HttpResponse.json({ id: 'cli-x' }, { status: 201 })
      }),
    )
    window.history.pushState({}, '', '/clientes/nuevo')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez')
    await user.type(screen.getByLabelText('Número de documento'), '001-1234567-8')
    await user.type(screen.getByLabelText('Teléfono'), '8095551111')
    await user.type(screen.getByLabelText('Dirección'), 'Calle 1')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    await waitFor(() => expect(creates).toBe(1))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MUTATION_TIMEOUT_MS)
    })
    vi.useRealTimers()
    expect(await screen.findByText(UNCONFIRMED_MUTATION_MESSAGE)).toBeInTheDocument()
    expect(creates).toBe(1)
  })

  it('usa el filename del Content-Disposition, con -anulada si la venta está anulada', async () => {
    loginOwner()
    seedSale(clientSaleDetailFixture())
    const active = await api.get<Blob>('/sales/sale-128/contract.pdf', { responseType: 'blob' })
    expect(active.headers['content-disposition']).toBe(
      'attachment; filename="contrato-venta-128.pdf"',
    )
    expect(active.headers['access-control-expose-headers']).toBe(CORS_EXPOSE_HEADERS)
    expect((await downloadSaleContract('sale-128')).filename).toBe('contrato-venta-128.pdf')

    seedSale(voidedSaleDetailFixture())
    const voided = await api.get<Blob>('/sales/sale-117/contract.pdf', { responseType: 'blob' })
    expect(voided.headers['content-disposition']).toBe(
      'attachment; filename="contrato-venta-117-anulada.pdf"',
    )
    expect(voided.headers['access-control-expose-headers']).toBe(CORS_EXPOSE_HEADERS)
    expect((await downloadSaleContract('sale-117')).filename).toBe(
      'contrato-venta-117-anulada.pdf',
    )
  })

  it('muestra el aviso de crédito solo cuando configured es false', async () => {
    loginOwner()
    window.history.pushState({}, '', '/negocio')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Crédito' })).toBeInTheDocument()
    expect(screen.queryByText('Aún no has configurado el crédito.')).not.toBeInTheDocument()

    cleanup()
    await resetAppQueryClient()
    seedCreditSettings({ configured: false, hasRow: false, surcharge_percent: '0' })
    window.history.pushState({}, '', '/negocio')
    renderApp()
    expect(await screen.findByText('Aún no has configurado el crédito.')).toBeInTheDocument()

    cleanup()
    await resetAppQueryClient()
    server.use(
      http.get('*/businesses/:id/credit-settings', () =>
        HttpResponse.json({
          interest_method: 'recargo_fijo',
          surcharge_kind: 'percent_of_financed',
          surcharge_percent: '0',
          surcharge_amount: null,
          allowed_frequencies: ['semanal', 'quincenal', 'mensual'],
          max_installments: 52,
          min_down_payment_percent: null,
        }),
      ),
    )
    window.history.pushState({}, '', '/negocio')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Crédito' })).toBeInTheDocument()
    expect(screen.queryByText('Aún no has configurado el crédito.')).not.toBeInTheDocument()
  })

  it('el cajero ve el crédito en solo lectura y el cobrador recibe No autorizado', async () => {
    loginCashier()
    seedBusinessRecord({ id: businesses.norte.id, rnc: null, address: null })
    window.history.pushState({}, '', '/negocio')
    renderApp()
    expect(await screen.findByText('Solo el dueño puede cambiar esta configuración.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar crédito' })).not.toBeInTheDocument()
    expect(screen.getByText('Falta el RNC o la dirección.')).toBeInTheDocument()

    cleanup()
    loginCollector()
    window.history.pushState({}, '', '/negocio')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'No autorizado' })).toBeInTheDocument()
  })

  it('POST /sales con configured false devuelve CREDIT_SETTINGS_MISSING o INCOMPLETE', async () => {
    loginOwner()
    const payload = {
      client_id: 'cli-1',
      item_description: 'Radio',
      price: '1000.00',
      down_payment: '0.00',
      installments: 2,
      frequency: 'mensual' as const,
    }

    const ready = await getCreditSettings(businesses.norte.id)
    expect(ready.configured).toBe(true)

    seedCreditSettings({ configured: false, hasRow: false })
    const missingSettings = await getCreditSettings(businesses.norte.id)
    expect(missingSettings.configured).toBe(false)
    expect(missingSettings.surcharge_percent).toBe('0')
    expect(missingSettings.max_installments).toBe(52)
    const missing = await createSale(payload, '11111111-1111-4111-8111-111111111111').catch(
      (error: unknown) => error,
    )
    expect(isApiError(missing) && missing.code === 'CREDIT_SETTINGS_MISSING').toBe(true)

    seedCreditSettings({ configured: false, hasRow: true, surcharge_percent: null })
    const incompleteSettings = await getCreditSettings(businesses.norte.id)
    expect(incompleteSettings.configured).toBe(false)
    const incomplete = await createSale(payload, '22222222-2222-4222-8222-222222222222').catch(
      (error: unknown) => error,
    )
    expect(isApiError(incomplete) && incomplete.code === 'CREDIT_SETTINGS_INCOMPLETE').toBe(true)
  })

  it('un replay de POST /sales expone Idempotent-Replayed', async () => {
    loginOwner()
    const payload = {
      client_id: 'cli-1',
      item_description: 'Radio',
      price: '1000.00',
      down_payment: '0.00',
      installments: 2,
      frequency: 'mensual' as const,
    }
    const key = '33333333-3333-4333-8333-333333333333'
    const first = await api.post('/sales', payload, { headers: { 'Idempotency-Key': key } })
    expect(first.status).toBe(201)
    expect(first.headers['access-control-expose-headers']).toBe(CORS_EXPOSE_HEADERS)
    expect(first.headers['idempotent-replayed']).toBeUndefined()

    const replay = await api.post('/sales', payload, { headers: { 'Idempotency-Key': key } })
    expect(replay.status).toBe(200)
    expect(replay.headers['idempotent-replayed']).toBe('true')
    expect(replay.headers['access-control-expose-headers']).toBe(CORS_EXPOSE_HEADERS)
    expect((replay.data as { id: string }).id).toBe((first.data as { id: string }).id)
  })

  it('la lista /ventas muestra el cliente, filtra y el cobrador no ve Nueva venta', async () => {
    loginOwner()
    seedSale(clientSaleFixture())
    seedSale(
      clientSaleFixture({
        id: 'sale-117',
        sale_number: 117,
        item_description: 'Abanico Royal',
        status: 'anulada',
        client: { id: 'cli-1', name: 'Ana Pérez' },
        installments_count: 4,
        frequency: 'semanal',
        total: '3600.00',
        balance: '0.00',
        voided_at: '2026-09-29T16:00:00.000Z',
        voided_by: { membership_id: 'mem-owner', name: 'Ana Pérez' },
      }),
    )
    window.history.pushState({}, '', '/ventas')
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByText('#128 · Nevera Mabe 14 pies')).toBeInTheDocument()
    expect(screen.getAllByText('Ana Pérez').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Anuladas' }))
    expect(await screen.findByText('#117 · Abanico Royal')).toBeInTheDocument()
    expect(screen.queryByText('#128 · Nevera Mabe 14 pies')).not.toBeInTheDocument()

    cleanup()
    loginCollector()
    window.history.pushState({}, '', '/ventas')
    renderApp()
    expect(await screen.findByText('Ventas de los clientes que cobras.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
  })
})
