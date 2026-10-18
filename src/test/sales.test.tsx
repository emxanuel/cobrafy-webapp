import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GENERIC_SALE_ERROR,
  IDEMPOTENCY_REUSED_BODY,
  IDEMPOTENCY_REUSED_TITLE,
} from '@/features/sales/lib/copy'
import {
  DISCARD_SALE_BACK,
  DISCARD_SALE_BODY,
  DISCARD_SALE_LABEL,
  DISCARD_SALE_TITLE,
  DISCARD_SALE_TOAST,
  PENDING_SALE_BODY,
  PENDING_SALE_EXPIRED_BODY,
  PENDING_SALE_EXPIRED_TITLE,
  PENDING_SALE_FAILED,
  PENDING_SALE_STILL_OFFLINE,
  PENDING_SALE_TITLE,
  PENDING_SALE_TTL_MS,
  PENDING_SALE_UNCONFIRMED,
  writePendingSale,
} from '@/features/sales/lib/pending-sale'
import { CREATE_SALE_TIMEOUT_MS } from '@/features/shared/services/client'
import { MONEY_INVALID_MESSAGE } from '@/features/sales/components/money-input'
import { quincenalOptions } from '@/features/sales/lib/calendar'
import { formatDueDate } from '@/features/shared/lib/format-due-date'
import { createSale } from '@/features/sales/services/requests'
import { readIdempotencyKey } from '@/features/sales/lib/idempotency'
import { hasXorDueAnchor, salePayloadFingerprint } from '@/features/sales/lib/sale-payload'
import { CREDIT_SETTINGS_LINKS_ENABLED } from '@/features/sales/lib/flags'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { authResponse, businesses, membership, users } from './fixtures'
import { saleWrites } from './handlers'
import { renderApp, seedAuth } from './render'
import { server } from './server'

async function loginCashier() {
  seedAuth({
    user: users.cashier,
    memberships: [membership(users.cashier, businesses.norte, 'cajero')],
    token: 'token-cashier',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

async function loginOwner() {
  seedAuth({
    user: users.owner,
    memberships: [membership(users.owner, businesses.norte, 'dueño')],
    token: 'token-owner',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

async function loginCollector() {
  seedAuth({
    user: users.collector,
    memberships: [membership(users.collector, businesses.norte, 'cobrador')],
    token: 'token-collector',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

async function goToNewSale() {
  expect(await screen.findByRole('heading', { name: 'Nueva venta' }, { timeout: 5000 })).toBeInTheDocument()
}

async function fillHappyPath(user: ReturnType<typeof userEvent.setup>, price = '18500.00') {
  await user.type(screen.getByLabelText('Artículo'), 'Nevera Mabe 14 pies')
  await user.type(screen.getByLabelText('Precio'), price)
}

async function waitForPlan() {
  await waitFor(() => expect(screen.getByText('✓ Actualizado')).toBeInTheDocument(), {
    timeout: 5000,
  })
}

function expectPurchasesLink() {
  expect(screen.getByRole('link', { name: 'Ver compras del cliente' })).toHaveAttribute(
    'href',
    '/clientes/cli-1/historial',
  )
}

async function confirmSale(user: ReturnType<typeof userEvent.setup>) {
  const confirm = await screen.findByRole('button', { name: 'Confirmar venta' })
  await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 })
  await user.click(confirm)
  await user.click(await screen.findByRole('button', { name: 'Registrar venta' }))
}

async function openConfirmSheet(user: ReturnType<typeof userEvent.setup>) {
  const confirm = await screen.findByRole('button', { name: 'Confirmar venta' })
  await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 })
  await user.click(confirm)
  expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeInTheDocument()
}

function pendingSaleKey(clientId = 'cli-1'): string | null {
  const raw = sessionStorage.getItem(`cobrafy.pendingSale:${clientId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { key?: string }
    return typeof parsed.key === 'string' ? parsed.key : null
  } catch {
    return null
  }
}

function expectNetworkWarning(options?: { stillOffline?: boolean; unconfirmed?: boolean }) {
  expect(screen.getAllByText(PENDING_SALE_TITLE).length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText(PENDING_SALE_BODY)).toBeInTheDocument()
  const retry = screen.getByRole('button', { name: 'Reintentar' })
  expect(retry).toHaveClass('min-h-12')
  if (options?.stillOffline) {
    expect(screen.getByText(PENDING_SALE_STILL_OFFLINE)).toBeInTheDocument()
  } else {
    expect(screen.queryByText(PENDING_SALE_STILL_OFFLINE)).not.toBeInTheDocument()
  }
  if (options?.unconfirmed) {
    expect(screen.getByText(PENDING_SALE_UNCONFIRMED)).toBeInTheDocument()
  } else {
    expect(screen.queryByText(PENDING_SALE_UNCONFIRMED)).not.toBeInTheDocument()
  }
  expectPurchasesLink()
  expect(screen.getByRole('button', { name: DISCARD_SALE_LABEL })).toBeInTheDocument()
  expect(screen.getByLabelText('Artículo')).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Confirmar venta' })).not.toBeInTheDocument()
  expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeTruthy()
}

function saleJson(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sale-1',
    sale_number: 201,
    client_id: 'cli-1',
    client: { id: 'cli-1', name: 'Ana Pérez' },
    seller_membership_id: 'mem-user-cashier-biz-norte',
    item_description: 'Nevera Mabe 14 pies',
    price: '18500.00',
    down_payment: '0.00',
    financed: '18500.00',
    surcharge: '3700.00',
    total: '22200.00',
    balance: '22200.00',
    surcharge_kind: 'percent_of_financed',
    surcharge_percent: '20.00',
    surcharge_amount: null,
    interest_method: 'recargo_fijo',
    frequency: 'mensual',
    installments_count: 12,
    anchor_date: '2026-11-17',
    anchor_offset: 0,
    first_due_date: '2026-11-17',
    status: 'activa',
    voided_at: null,
    void_reason: null,
    voided_by: null,
    created_at: '2026-10-18T00:00:00.000Z',
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
    ...overrides,
  }
}

describe('CBF-206 ventas', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.history.pushState({}, '', '/')
  })

  it('el cobrador no ve Nueva venta y la ruta muestra No autorizado', async () => {
    loginCollector()
    window.history.pushState({}, '', '/clientes')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()

    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'No autorizado' })).toBeInTheDocument()
    expect(screen.getByText('Solo el dueño y el cajero pueden registrar ventas.')).toBeInTheDocument()
  })

  it('muestra el plan 10,000/3 con 3,333.33 / 3,333.33 / 3,333.34', async () => {
    loginCashier()
    server.use(
      http.post('*/sales/simulate', () =>
        HttpResponse.json({
          financed: '10000.00',
          surcharge: '0.00',
          total: '10000.00',
          installment_amount: '3333.33',
          installments: [
            { number: 1, due_date: '2026-11-17', amount: '3333.33' },
            { number: 2, due_date: '2026-12-17', amount: '3333.33' },
            { number: 3, due_date: '2027-01-17', amount: '3333.34' },
          ],
          settings_configured: true,
          anchor_date: '2026-11-17',
          anchor_offset: 0,
          warnings: [],
        }),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user, '10000.00')
    await waitForPlan()
    const plan = () => within(screen.getByText('Plan de pago').closest('section')!)
    expect(plan().getAllByText('RD$ 3,333.33', { exact: true })).toHaveLength(3)
    expect(plan().getByText(/La última cuota es de RD\$ 3,333.34/)).toBeInTheDocument()
    expect(plan().getAllByText('RD$ 3,333.34', { exact: true })).toHaveLength(1)
    await user.click(plan().getByText(/Ver calendario/))
    expect(plan().getByRole('table')).toBeVisible()
    expect(plan().getAllByText('RD$ 3,333.33', { exact: true })).toHaveLength(3)
    expect(plan().getAllByText('RD$ 3,333.34', { exact: true })).toHaveLength(1)
  })

  it('muestra 1,607.14 / 1,607.16 tal cual vienen del simulador', async () => {
    loginCashier()
    server.use(
      http.post('*/sales/simulate', () =>
        HttpResponse.json({
          financed: '10000.00',
          surcharge: '1250.00',
          total: '11250.00',
          installment_amount: '1607.14',
          installments: [
            { number: 1, due_date: '2026-10-31', amount: '1607.14' },
            { number: 2, due_date: '2026-11-30', amount: '1607.14' },
            { number: 3, due_date: '2026-12-31', amount: '1607.14' },
            { number: 4, due_date: '2027-01-31', amount: '1607.14' },
            { number: 5, due_date: '2027-02-28', amount: '1607.14' },
            { number: 6, due_date: '2027-03-31', amount: '1607.14' },
            { number: 7, due_date: '2027-04-30', amount: '1607.16' },
          ],
          settings_configured: true,
          anchor_date: '2026-10-31',
          anchor_offset: 0,
          warnings: [],
        }),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user, '12000.00')
    await waitForPlan()
    const plan = () => within(screen.getByText('Plan de pago').closest('section')!)
    expect(plan().getAllByText('RD$ 1,607.14', { exact: true })).toHaveLength(7)
    expect(plan().getByText(/La última cuota es de RD\$ 1,607.16/)).toBeInTheDocument()
    expect(plan().getAllByText('RD$ 1,607.16', { exact: true })).toHaveLength(1)
    await user.click(plan().getByText(/Ver calendario/))
    expect(plan().getByRole('table')).toBeVisible()
    expect(plan().getAllByText('RD$ 1,607.14', { exact: true })).toHaveLength(7)
    expect(plan().getAllByText('RD$ 1,607.16', { exact: true })).toHaveLength(1)
  })

  it('mensual desde el 31-ene muestra 28/02, 31/03 y 30/04', async () => {
    loginCashier()
    server.use(
      http.post('*/sales/simulate', () =>
        HttpResponse.json({
          financed: '10000.00',
          surcharge: '0.00',
          total: '10000.00',
          installment_amount: '2500.00',
          installments: [
            { number: 1, due_date: '2026-01-31', amount: '2500.00' },
            { number: 2, due_date: '2026-02-28', amount: '2500.00' },
            { number: 3, due_date: '2026-03-31', amount: '2500.00' },
            { number: 4, due_date: '2026-04-30', amount: '2500.00' },
          ],
          settings_configured: true,
          anchor_date: '2026-01-31',
          anchor_offset: 0,
          warnings: [],
        }),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await user.click(await screen.findByText(/Ver calendario/))
    expect(screen.getByText('28/02/2026')).toBeInTheDocument()
    expect(screen.getByText('31/03/2026')).toBeInTheDocument()
    expect(screen.getByText('30/04/2026')).toBeInTheDocument()
  })

  it('en quincenal el selector solo ofrece el 15 y el fin de mes', async () => {
    loginCashier()
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await user.click(screen.getByRole('button', { name: 'Quincenal' }))
    const more = screen.queryByRole('button', { name: 'Ver más fechas' })
    if (more) await user.click(more)
    const group = screen.getByRole('radiogroup', { name: 'Primera cuota' })
    const expected = quincenalOptions()
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(expected.length)
    expect(expected.map((item) => formatDueDate(item.iso))).toEqual(
      radios.map((radio) => {
        const label = radio.closest('label')
        const date = label?.querySelector('.text-heading')
        return (date?.textContent ?? '').replace(/^\s*/, '').trim()
      }),
    )
    expect(expected.every((item) => item.kind === 'day15' || item.kind === 'month_end')).toBe(true)
    expect(screen.getByText(/día 15 y el último día/i)).toBeInTheDocument()
  })

  it('el POST lleva strings decimales y first_due_date XOR anchors', async () => {
    loginCashier()
    useSessionStore.getState().applyAuth(
      authResponse({
        user: users.cashier,
        memberships: [membership(users.cashier, businesses.norte, 'cajero')],
        token: 'token-cashier',
      }),
    )
    await createSale(
      {
        client_id: 'cli-1',
        item_description: 'Radio',
        price: '999.99',
        down_payment: '0.00',
        installments: 3,
        frequency: 'mensual',
        anchor_date: '2026-11-17',
        anchor_offset: 0,
      },
      '11111111-1111-1111-1111-111111111111',
    )
    const last = saleWrites.at(-1)
    expect(last?.body).toMatchObject({
      price: '999.99',
      down_payment: '0.00',
      anchor_date: '2026-11-17',
      anchor_offset: 0,
    })
    expect(typeof (last?.body as { price: string }).price).toBe('string')
    expect((last?.body as { price: unknown }).price).not.toBe(999.99)
    expect(last?.idempotencyKey).toBe('11111111-1111-1111-1111-111111111111')
    expect(hasXorDueAnchor(last?.body as never)).toBe(true)
  })

  it('un error de red deja la venta por confirmar; Reintentar manda el mismo cuerpo y la misma clave', async () => {
    loginCashier()
    const keys: string[] = []
    let fails = 0
    server.use(
      http.post('*/sales', async ({ request }) => {
        const key = request.headers.get('Idempotency-Key')
        if (key) keys.push(key)
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: key,
        })
        fails += 1
        if (fails <= 2) return HttpResponse.error()
        return HttpResponse.json(saleJson({ id: 'sale-retry', sale_number: 44 }), { status: 201 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await confirmSale(user)
    expectNetworkWarning()
    expect(screen.getByLabelText('Artículo')).toHaveValue('Nevera Mabe 14 pies')
    expect(screen.getByLabelText('Artículo')).toBeDisabled()
    expect(screen.getByLabelText('Precio')).toBeDisabled()
    expect(saleWrites).toHaveLength(1)
    expect(keys).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Confirmar venta' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Artículo'), ' XL')
    expect(screen.getByLabelText('Artículo')).toHaveValue('Nevera Mabe 14 pies')
    expect(saleWrites).toHaveLength(1)
    expect(keys).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(keys.length).toBe(2))
    expectNetworkWarning({ stillOffline: true })
    expect(keys[0]).toBe(keys[1])
    expect(saleWrites[1]?.body).toEqual(saleWrites[0]?.body)
    expect(keys[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Listo, venta #44 registrada.')).toBeInTheDocument()
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeNull()
  })

  it('Reintentar con 200 replay llega a la misma venta y conserva la clave al cerrar la hoja', async () => {
    loginCashier()
    const keys: string[] = []
    const replay = saleJson({ id: 'sale-replay-lock', sale_number: 88 })
    let attempt = 0
    let release: (() => void) | undefined
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post('*/sales', async ({ request }) => {
        const key = request.headers.get('Idempotency-Key')
        if (key) keys.push(key)
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: key,
        })
        attempt += 1
        if (attempt === 1) return HttpResponse.error()
        await hold
        return HttpResponse.json(replay, { status: 200 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await openConfirmSheet(user)
    await user.click(screen.getByRole('button', { name: 'Volver a editar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await openConfirmSheet(user)
    await user.click(await screen.findByRole('button', { name: 'Registrar venta' }))
    expectNetworkWarning()
    const firstBody = saleWrites[0]?.body as Parameters<typeof salePayloadFingerprint>[0]
    expect(readIdempotencyKey(salePayloadFingerprint(firstBody))).toBe(keys[0])
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    const confirming = await screen.findByRole('button', { name: 'Confirmando…' })
    expect(confirming).toBeDisabled()
    expect(screen.queryByText(PENDING_SALE_STILL_OFFLINE)).not.toBeInTheDocument()
    release?.()
    expect(await screen.findByText('Listo, venta #88 registrada.')).toBeInTheDocument()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
    expect(saleWrites[1]?.body).toEqual(saleWrites[0]?.body)
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeNull()
  })

  it('recargar conserva la clave y Reintentar llega a la misma venta', async () => {
    loginCashier()
    const keys: string[] = []
    const replay = saleJson({ id: 'sale-reload', sale_number: 91 })
    let attempt = 0
    server.use(
      http.post('*/sales', async ({ request }) => {
        const key = request.headers.get('Idempotency-Key')
        if (key) keys.push(key)
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: key,
        })
        attempt += 1
        if (attempt === 1) return HttpResponse.error()
        return HttpResponse.json(replay, { status: 200 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await confirmSale(user)
    expectNetworkWarning()
    const firstKey = keys[0]
    const firstBody = saleWrites[0]?.body as Parameters<typeof salePayloadFingerprint>[0]
    expect(readIdempotencyKey(salePayloadFingerprint(firstBody))).toBe(firstKey)

    cleanup()
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    renderApp()
    await goToNewSale()
    expectNetworkWarning()
    expect(screen.getByLabelText('Artículo')).toHaveValue('Nevera Mabe 14 pies')
    expect(readIdempotencyKey(salePayloadFingerprint(firstBody))).toBe(firstKey)

    await user.click(screen.getByRole('link', { name: '‹ Volver a la ficha' }))
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /Nueva venta/ }))
    expect(await screen.findByRole('heading', { name: 'Nueva venta' })).toBeInTheDocument()
    expectNetworkWarning()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Listo, venta #91 registrada.')).toBeInTheDocument()
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(firstKey)
    expect(saleWrites[1]?.body).toEqual(saleWrites[0]?.body)
  })

  it('cambiar el payload genera una clave nueva', async () => {
    loginCashier()
    const keys: string[] = []
    let attempt = 0
    server.use(
      http.post('*/sales', async ({ request }) => {
        const key = request.headers.get('Idempotency-Key')
        if (key) keys.push(key)
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: key,
        })
        attempt += 1
        if (attempt === 1) return HttpResponse.error()
        if (attempt === 2) {
          return HttpResponse.json(
            { detail: [{ field: null, code: 'SOME_NEW_CODE', message: 'debug interno' }] },
            { status: 409 },
          )
        }
        return HttpResponse.json(saleJson({ id: 'sale-new-payload', sale_number: 77 }), { status: 201 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await confirmSale(user)
    expectNetworkWarning()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(PENDING_SALE_FAILED)).toBeInTheDocument()
    expect(keys[0]).toBe(keys[1])
    await user.type(screen.getByLabelText('Artículo'), ' XL')
    await confirmSale(user)
    await waitFor(() => expect(keys.length).toBe(3))
    expect(keys[2]).not.toBe(keys[0])
    expect(saleWrites[2]?.body).not.toEqual(saleWrites[0]?.body)
    expect(await screen.findByText('Listo, venta #77 registrada.')).toBeInTheDocument()
  })

  it('403, 429 y 401 al reintentar mantienen el bloqueo y la misma clave', async () => {
    loginCashier()
    const keys: string[] = []
    let attempt = 0
    server.use(
      http.post('*/sales', async ({ request }) => {
        const key = request.headers.get('Idempotency-Key')
        if (key) keys.push(key)
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: key,
        })
        attempt += 1
        if (attempt === 1) return HttpResponse.error()
        if (attempt === 2) {
          return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
        }
        if (attempt === 3) {
          return HttpResponse.json({ detail: 'Too Many Requests' }, { status: 429 })
        }
        return HttpResponse.json({ detail: 'no autenticado' }, { status: 401 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await confirmSale(user)
    expectNetworkWarning()
    const firstKey = keys[0]
    expect(pendingSaleKey()).toBe(firstKey)
    expect(saleWrites).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(keys.length).toBe(2))
    expectNetworkWarning({ unconfirmed: true })
    expect(keys[1]).toBe(firstKey)
    expect(pendingSaleKey()).toBe(firstKey)
    expect(screen.queryByRole('button', { name: 'Confirmar venta' })).not.toBeInTheDocument()
    expect(saleWrites).toHaveLength(2)
    expect(saleWrites[1]?.body).toEqual(saleWrites[0]?.body)

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(keys.length).toBe(3))
    expectNetworkWarning({ unconfirmed: true })
    expect(keys[2]).toBe(firstKey)
    expect(pendingSaleKey()).toBe(firstKey)
    expect(screen.queryByRole('button', { name: 'Confirmar venta' })).not.toBeInTheDocument()
    expect(saleWrites).toHaveLength(3)
    expect(saleWrites[2]?.body).toEqual(saleWrites[0]?.body)

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(keys.length).toBe(4))
    expect(keys[3]).toBe(firstKey)
    expect(pendingSaleKey()).toBe(firstKey)
    expect(new Set(keys).size).toBe(1)
    expect(saleWrites).toHaveLength(4)
    expect(saleWrites[3]?.body).toEqual(saleWrites[0]?.body)
  })

  it('un 422 definitivo desbloquea y muestra que la venta no se registró', async () => {
    loginCashier()
    let attempt = 0
    server.use(
      http.post('*/sales', async ({ request }) => {
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: request.headers.get('Idempotency-Key'),
        })
        attempt += 1
        if (attempt === 1) return HttpResponse.error()
        return HttpResponse.json(
          {
            detail: [
              {
                field: 'item_description',
                code: 'ITEM_DESCRIPTION_INVALID',
                message: 'el artículo no es válido',
              },
            ],
          },
          { status: 422 },
        )
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await confirmSale(user)
    expectNetworkWarning()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(PENDING_SALE_FAILED)).toBeInTheDocument()
    expect(screen.getByText('El artículo no es válido.')).toBeInTheDocument()
    expect(screen.queryByText(PENDING_SALE_BODY)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Artículo')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Quitar una cuota' })).toBeInTheDocument()
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeNull()
  })

  it('a las 23 h oculta Reintentar y deja Ver compras y Descartar', async () => {
    loginCashier()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    writePendingSale('cli-1', {
      key: 'expired-key',
      payload: {
        client_id: 'cli-1',
        item_description: 'Nevera Mabe 14 pies',
        price: '18500.00',
        down_payment: '0.00',
        installments: 12,
        frequency: 'mensual',
        first_due_date: '2026-11-17',
      },
      snapshot: {
        client_id: 'cli-1',
        item_description: 'Nevera Mabe 14 pies',
        price: '18500.00',
        down_payment: '0.00',
        installments: 12,
        frequency: 'mensual',
        first_due_date: '2026-11-17',
      },
      created_at: new Date().toISOString(),
    })
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    renderApp()
    await goToNewSale()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_SALE_TTL_MS)
    })
    expect(screen.getByText(PENDING_SALE_EXPIRED_TITLE)).toBeInTheDocument()
    expect(screen.getByText(PENDING_SALE_EXPIRED_BODY)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver compras del cliente' })).toHaveClass('min-h-12')
    expect(screen.getByRole('button', { name: DISCARD_SALE_LABEL })).toHaveClass('min-h-11')
    expect(screen.getByLabelText('Artículo')).toBeDisabled()
  })

  it('Volver en Descartar mantiene el bloqueo', async () => {
    loginCashier()
    server.use(
      http.post('*/sales', async ({ request }) => {
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: request.headers.get('Idempotency-Key'),
        })
        return HttpResponse.error()
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await confirmSale(user)
    expectNetworkWarning()
    const storedKey = pendingSaleKey()
    await user.click(screen.getByRole('button', { name: DISCARD_SALE_LABEL }))
    expect(screen.getByRole('heading', { name: DISCARD_SALE_TITLE })).toBeInTheDocument()
    expect(screen.getByText(DISCARD_SALE_BODY)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: DISCARD_SALE_BACK }))
    expect(screen.queryByRole('heading', { name: DISCARD_SALE_TITLE })).not.toBeInTheDocument()
    expectNetworkWarning()
    expect(pendingSaleKey()).toBe(storedKey)
  })

  it('Descartar vacía el formulario, muestra el aviso y la siguiente venta usa otra clave', async () => {
    loginCashier()
    const keys: string[] = []
    let failFirst = true
    server.use(
      http.post('*/sales', async ({ request }) => {
        const key = request.headers.get('Idempotency-Key')
        if (key) keys.push(key)
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: key,
        })
        if (failFirst) {
          failFirst = false
          return HttpResponse.error()
        }
        return HttpResponse.json(saleJson({ id: 'sale-after-discard', sale_number: 55 }), {
          status: 201,
        })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await confirmSale(user)
    expectNetworkWarning()
    const firstKey = pendingSaleKey()
    await user.click(screen.getByRole('button', { name: DISCARD_SALE_LABEL }))
    const sheet = screen.getByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: DISCARD_SALE_LABEL }))
    expect(screen.getByText(DISCARD_SALE_TOAST)).toBeInTheDocument()
    expect(screen.getByLabelText('Artículo')).toHaveValue('')
    expect(screen.getByLabelText('Artículo')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeInTheDocument()
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeNull()
    await fillHappyPath(user)
    await confirmSale(user)
    expect(await screen.findByText('Listo, venta #55 registrada.')).toBeInTheDocument()
    expect(keys.at(-1)).not.toBe(firstKey)
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeNull()
  })

  it('un timeout del POST deja el bloqueo con la misma clave', async () => {
    loginCashier()
    const keys: string[] = []
    server.use(
      http.post('*/sales', async ({ request }) => {
        const key = request.headers.get('Idempotency-Key')
        if (key) keys.push(key)
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: key,
        })
        await delay('infinite')
        return HttpResponse.json(saleJson(), { status: 201 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await openConfirmSheet(user)
    const registrar = screen.getByRole('button', { name: 'Registrar venta' })
    vi.useFakeTimers()
    fireEvent.click(registrar)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CREATE_SALE_TIMEOUT_MS)
    })
    vi.useRealTimers()
    await waitFor(() => expect(screen.getAllByText(PENDING_SALE_TITLE).length).toBeGreaterThanOrEqual(2))
    expect(keys).toHaveLength(1)
    expectNetworkWarning()
    expect(pendingSaleKey()).toBe(keys[0])
    expect(screen.queryByRole('button', { name: 'Confirmar venta' })).not.toBeInTheDocument()
  })

  it('un 409 con copy propio desbloquea y muestra ese aviso', async () => {
    loginCashier()
    let attempt = 0
    server.use(
      http.post('*/sales', async ({ request }) => {
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: request.headers.get('Idempotency-Key'),
        })
        attempt += 1
        if (attempt === 1) return HttpResponse.error()
        return HttpResponse.json(
          {
            detail: [
              {
                field: null,
                code: 'CLIENT_BLOCKED',
                message: 'Atraso de 3 cuotas',
              },
            ],
          },
          { status: 409 },
        )
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await confirmSale(user)
    expectNetworkWarning()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Este cliente está bloqueado: Atraso de 3 cuotas.')).toBeInTheDocument()
    expect(screen.getByText('No se le puede vender a crédito.')).toBeInTheDocument()
    expect(screen.queryByText(PENDING_SALE_BODY)).not.toBeInTheDocument()
    expect(screen.queryByText(PENDING_SALE_FAILED)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Artículo')).toBeEnabled()
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeNull()
  })

  it('un 409 desconocido al reintentar desbloquea con el aviso de no registrada', async () => {
    loginCashier()
    let attempt = 0
    server.use(
      http.post('*/sales', async ({ request }) => {
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: request.headers.get('Idempotency-Key'),
        })
        attempt += 1
        if (attempt === 1) return HttpResponse.error()
        return HttpResponse.json(
          {
            detail: [{ field: null, code: 'SOME_NEW_CODE', message: 'debug interno' }],
          },
          { status: 409 },
        )
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await confirmSale(user)
    expectNetworkWarning()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(PENDING_SALE_FAILED)).toBeInTheDocument()
    expect(screen.queryByText('debug interno')).not.toBeInTheDocument()
    expect(screen.queryByText(PENDING_SALE_BODY)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Artículo')).toBeEnabled()
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeNull()
  })

  it('un monto inválido muestra Monto inválido y deshabilita Confirmar', async () => {
    loginCashier()
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await user.type(screen.getByLabelText('Artículo'), 'Nevera')
    await user.type(screen.getByLabelText('Precio'), '1850O')
    expect(screen.getAllByText(MONEY_INVALID_MESSAGE).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
  })

  it('un 200 de replay cuenta como venta registrada', async () => {
    loginCashier()
    server.use(
      http.post('*/sales', async ({ request }) => {
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: request.headers.get('Idempotency-Key'),
        })
        return HttpResponse.json(saleJson({ id: 'sale-replay', sale_number: 88 }), { status: 200 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    const confirm = await screen.findByRole('button', { name: 'Confirmar venta' })
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 })
    await user.click(confirm)
    await user.click(await screen.findByRole('button', { name: 'Registrar venta' }))
    expect(await screen.findByText('Listo, venta #88 registrada.')).toBeInTheDocument()
    expect(sessionStorage.getItem('cobrafy.pendingSale:cli-1')).toBeNull()
  })

  it('un doble clic en Registrar venta manda una sola petición y la misma clave', async () => {
    loginCashier()
    const keys: string[] = []
    let release: (() => void) | undefined
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post('*/sales', async ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key') ?? '')
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: request.headers.get('Idempotency-Key'),
        })
        await hold
        return HttpResponse.json(saleJson({ id: 'sale-once' }), { status: 201 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    const confirm = await screen.findByRole('button', { name: 'Confirmar venta' })
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 })
    await user.click(confirm)
    const registrar = await screen.findByRole('button', { name: 'Registrar venta' })
    await user.click(registrar)
    await user.click(registrar)
    await waitFor(() => expect(keys.length).toBe(1))
    release?.()
    expect(await screen.findByText(/Listo, venta #/)).toBeInTheDocument()
    expect(saleWrites).toHaveLength(1)
    expect(keys).toHaveLength(1)
  })

  it('una simulación vieja o fuera de orden no habilita Confirmar', async () => {
    loginCashier()
    let releaseSlow: (() => void) | undefined
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve
    })
    server.use(
      http.post('*/sales/simulate', async ({ request }) => {
        const body = (await request.json()) as { price?: string }
        if (body.price === '18500.00') {
          await slow
          return HttpResponse.json({
            financed: '18500.00',
            surcharge: '3700.00',
            total: '22200.00',
            installment_amount: '1850.00',
            installments: [
              { number: 1, due_date: '2026-11-17', amount: '1850.00' },
              { number: 2, due_date: '2026-12-17', amount: '1850.00' },
            ],
            settings_configured: true,
            anchor_date: '2026-11-17',
            anchor_offset: 0,
            warnings: [],
          })
        }
        return HttpResponse.json({
          financed: '10000.00',
          surcharge: '0.00',
          total: '10000.00',
          installment_amount: '3333.33',
          installments: [
            { number: 1, due_date: '2026-11-17', amount: '3333.33' },
            { number: 2, due_date: '2026-12-17', amount: '3333.33' },
            { number: 3, due_date: '2027-01-17', amount: '3333.34' },
          ],
          settings_configured: true,
          anchor_date: '2026-11-17',
          anchor_offset: 0,
          warnings: [],
        })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user, '18500.00')
    await waitFor(() => expect(screen.getAllByText('Calculando…').length).toBeGreaterThan(0), {
      timeout: 3000,
    })
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
    await user.clear(screen.getByLabelText('Precio'))
    await user.type(screen.getByLabelText('Precio'), '10000.00')
    await waitFor(() => expect(screen.getAllByText('RD$ 3,333.33').length).toBeGreaterThan(0), {
      timeout: 4000,
    })
    const confirm = screen.getByRole('button', { name: 'Confirmar venta' })
    await waitFor(() => expect(confirm).toBeEnabled())
    releaseSlow?.()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(confirm).toBeEnabled()
    expect(screen.getAllByText('RD$ 3,333.33').length).toBeGreaterThan(0)
    expect(screen.queryByText('RD$ 1,850.00')).not.toBeInTheDocument()
  })

  it('409 IDEMPOTENCY_KEY_REUSED muestra el aviso y el siguiente confirm usa otra clave', async () => {
    loginCashier()
    const keys: string[] = []
    let reused = false
    server.use(
      http.post('*/sales', async ({ request }) => {
        const key = request.headers.get('Idempotency-Key')
        if (key) keys.push(key)
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: key,
        })
        if (!reused) {
          reused = true
          return HttpResponse.json(
            {
              detail: [
                {
                  field: null,
                  code: 'IDEMPOTENCY_KEY_REUSED',
                  message: 'esa clave de idempotencia ya se usó con otro cuerpo',
                },
              ],
            },
            { status: 409 },
          )
        }
        return HttpResponse.json(saleJson({ id: 'sale-new-key' }), { status: 201 })
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    const confirm = await screen.findByRole('button', { name: 'Confirmar venta' })
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 })
    await user.click(confirm)
    await user.click(await screen.findByRole('button', { name: 'Registrar venta' }))
    expect(await screen.findByText(IDEMPOTENCY_REUSED_TITLE)).toBeInTheDocument()
    expect(screen.getByText(IDEMPOTENCY_REUSED_BODY)).toBeInTheDocument()
    expectPurchasesLink()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    const closeButtons = screen.getAllByRole('button', { name: 'Cerrar' })
    await user.click(closeButtons[closeButtons.length - 1]!)
    await user.click(await screen.findByRole('button', { name: 'Confirmar venta' }))
    await user.click(await screen.findByRole('button', { name: 'Registrar venta' }))
    await waitFor(() => expect(keys.length).toBe(2))
    expect(keys[1]).not.toBe(keys[0])
    expect(await screen.findByText(/Listo, venta #/)).toBeInTheDocument()
  })

  it('409 IDEMPOTENCY_KEY_REUSED desde Reintentar se muestra fuera de la hoja', async () => {
    loginCashier()
    let attempt = 0
    server.use(
      http.post('*/sales', async ({ request }) => {
        saleWrites.push({
          method: 'POST',
          url: request.url,
          body: await request.json(),
          idempotencyKey: request.headers.get('Idempotency-Key'),
        })
        attempt += 1
        if (attempt === 1) return HttpResponse.error()
        return HttpResponse.json(
          {
            detail: [
              {
                field: null,
                code: 'IDEMPOTENCY_KEY_REUSED',
                message: 'esa clave de idempotencia ya se usó con otro cuerpo',
              },
            ],
          },
          { status: 409 },
        )
      }),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    const confirm = await screen.findByRole('button', { name: 'Confirmar venta' })
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 })
    await user.click(confirm)
    await user.click(await screen.findByRole('button', { name: 'Registrar venta' }))
    expectNetworkWarning()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(IDEMPOTENCY_REUSED_TITLE)).toBeInTheDocument()
    expect(screen.getByText(IDEMPOTENCY_REUSED_BODY)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expectPurchasesLink()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('recargo fijo muestra Recargo (monto fijo)', async () => {
    loginCashier()
    server.use(
      http.get('*/businesses/:id/credit-settings', () =>
        HttpResponse.json({
          interest_method: 'recargo_fijo',
          surcharge_kind: 'fixed_amount',
          surcharge_percent: null,
          surcharge_amount: '500.00',
          allowed_frequencies: ['semanal', 'quincenal', 'mensual'],
          max_installments: 24,
          min_down_payment_percent: '10.00',
        }),
      ),
      http.post('*/sales/simulate', () =>
        HttpResponse.json({
          financed: '10000.00',
          surcharge: '500.00',
          total: '10500.00',
          installment_amount: '3500.00',
          installments: [
            { number: 1, due_date: '2026-11-17', amount: '3500.00' },
            { number: 2, due_date: '2026-12-17', amount: '3500.00' },
            { number: 3, due_date: '2027-01-17', amount: '3500.00' },
          ],
          settings_configured: true,
          anchor_date: '2026-11-17',
          anchor_offset: 0,
          warnings: [],
        }),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user, '10000.00')
    await waitForPlan()
    expect(screen.getByText('Recargo (monto fijo)')).toBeInTheDocument()
    expect(screen.getByText('RD$ 500.00')).toBeInTheDocument()
  })

  it('quincenal muestra el 15 y el fin de mes tal cual vienen del simulador', async () => {
    loginCashier()
    server.use(
      http.post('*/sales/simulate', () =>
        HttpResponse.json({
          financed: '10000.00',
          surcharge: '0.00',
          total: '10000.00',
          installment_amount: '2500.00',
          installments: [
            { number: 1, due_date: '2026-10-15', amount: '2500.00' },
            { number: 2, due_date: '2026-10-31', amount: '2500.00' },
            { number: 3, due_date: '2026-11-15', amount: '2500.00' },
            { number: 4, due_date: '2026-11-30', amount: '2500.00' },
          ],
          settings_configured: true,
          anchor_date: '2026-10-15',
          anchor_offset: 0,
          warnings: [],
        }),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user, '10000.00')
    await user.click(screen.getByRole('button', { name: 'Quincenal' }))
    await waitForPlan()
    await user.click(screen.getByText(/Ver calendario/))
    expect(screen.getAllByText('15/10/2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText('31/10/2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText('15/11/2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText('30/11/2026').length).toBeGreaterThan(0)
  })

  it('409 de lista se enruta por código; 422 va al campo', async () => {
    loginOwner()
    expect(CREDIT_SETTINGS_LINKS_ENABLED).toBe(false)
    server.use(
      http.post('*/sales/simulate', () =>
        HttpResponse.json(
          {
            detail: [
              {
                field: null,
                code: 'CREDIT_SETTINGS_INCOMPLETE',
                message: 'La configuración de crédito del negocio está incompleta',
              },
            ],
          },
          { status: 409 },
        ),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await waitFor(
      () => expect(screen.getByText('La configuración de crédito está incompleta.')).toBeInTheDocument(),
      { timeout: 4000 },
    )
    expect(screen.queryByRole('link', { name: 'Revisar configuración' })).not.toBeInTheDocument()

    server.use(
      http.post('*/sales/simulate', () =>
        HttpResponse.json(
          {
            detail: [
              {
                field: 'down_payment',
                code: 'DOWN_PAYMENT_INVALID',
                message: 'la inicial debe ser menor que el precio',
              },
            ],
          },
          { status: 422 },
        ),
      ),
    )
    await user.clear(screen.getByLabelText('Inicial'))
    await user.type(screen.getByLabelText('Inicial'), '18500.00')
    expect(await screen.findByText('La inicial debe ser menor que el precio.')).toBeInTheDocument()
    expect(screen.getByText('Corrige el campo marcado para ver las cuotas.')).toBeInTheDocument()
    expect(screen.queryByText('Espera a que termine el cálculo.')).not.toBeInTheDocument()
  })

  it('un 409 de texto plano y un código desconocido no rompen la pantalla', async () => {
    loginCashier()
    server.use(
      http.post('*/sales/simulate', () =>
        HttpResponse.json({ detail: 'conflicto de crédito' }, { status: 409 }),
      ),
    )
    window.history.pushState({}, '', '/clientes/cli-1/ventas/nueva')
    const user = userEvent.setup()
    renderApp()
    await goToNewSale()
    await fillHappyPath(user)
    await waitFor(
      () => expect(screen.getByText('conflicto de crédito')).toBeInTheDocument(),
      { timeout: 4000 },
    )
    expect(screen.queryByText(GENERIC_SALE_ERROR)).not.toBeInTheDocument()

    server.use(
      http.post('*/sales/simulate', () =>
        HttpResponse.json(
          { detail: [{ field: null, code: 'SOME_NEW_CODE', message: 'debug' }] },
          { status: 409 },
        ),
      ),
    )
    await user.clear(screen.getByLabelText('Precio'))
    await user.type(screen.getByLabelText('Precio'), '19000.00')
    expect(await screen.findByText('debug')).toBeInTheDocument()
  })
})
