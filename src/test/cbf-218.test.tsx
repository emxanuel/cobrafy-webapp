import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { useBusinessStore } from '@/features/business/stores/business-store'
import {
  buildCreditSettingsWrite,
  getCreditSettings,
  normalizeCreditSettings,
  putCreditSettings,
  toCreditSettingsWrite,
} from '@/features/sales/services/requests'
import { LATE_FEE_FIELDS, type CreditSettingsLateFees } from '@/features/sales/services/types'
import { businesses, membership, users } from './fixtures'
import { creditSettingsWrites, seedCreditSettings } from './handlers'
import { renderApp, seedAuth } from './render'
import { server } from './server'

const CREDIT_WRITE_KEYS = [
  'allowed_frequencies',
  'interest_method',
  'late_fee_cap',
  'late_fee_fixed',
  'late_fee_grace_days',
  'late_fee_kind',
  'late_fee_percent',
  'max_installments',
  'min_down_payment_percent',
  'surcharge_amount',
  'surcharge_kind',
  'surcharge_percent',
] as const

const MORA_PERCENT: CreditSettingsLateFees = {
  late_fee_kind: 'percent',
  late_fee_percent: '12.5',
  late_fee_fixed: null,
  late_fee_grace_days: 3,
  late_fee_cap: '500.00',
}

const MORA_FIXED_WITH_CAP: CreditSettingsLateFees = {
  late_fee_kind: 'fixed',
  late_fee_percent: null,
  late_fee_fixed: '150.00',
  late_fee_grace_days: 5,
  late_fee_cap: '800.00',
}

const MORA_FIXED_NO_CAP: CreditSettingsLateFees = {
  late_fee_kind: 'fixed',
  late_fee_percent: null,
  late_fee_fixed: '150.00',
  late_fee_grace_days: 5,
  late_fee_cap: null,
}

const MORA_OFF: CreditSettingsLateFees = {
  late_fee_kind: null,
  late_fee_percent: null,
  late_fee_fixed: null,
  late_fee_grace_days: 0,
  late_fee_cap: null,
}

function loginOwner() {
  seedAuth({
    user: users.owner,
    memberships: [membership(users.owner, businesses.norte, 'dueño')],
    token: 'token-owner',
  })
  useBusinessStore.getState().setActiveBusinessId(businesses.norte.id)
}

function lateFeesOf(row: Record<string, unknown> | CreditSettingsLateFees): CreditSettingsLateFees {
  return {
    late_fee_kind: row.late_fee_kind as CreditSettingsLateFees['late_fee_kind'],
    late_fee_percent: row.late_fee_percent as string | null,
    late_fee_fixed: row.late_fee_fixed as string | null,
    late_fee_grace_days: row.late_fee_grace_days as number,
    late_fee_cap: row.late_fee_cap as string | null,
  }
}

function expectExactWriteKeys(body: Record<string, unknown>) {
  expect(Object.keys(body).sort()).toEqual([...CREDIT_WRITE_KEYS].sort())
  expect(body).not.toHaveProperty('configured')
  expect(body).not.toHaveProperty('late_fee_percent_bp')
  expect(body).not.toHaveProperty('late_fee_fixed_cents')
  expect(body).not.toHaveProperty('late_fee_cap_cents')
}

async function saveAfterChangingPlazoOnly() {
  const writesBefore = creditSettingsWrites.length
  loginOwner()
  window.history.pushState({}, '', '/negocio')
  renderApp()
  expect(await screen.findByRole('heading', { name: 'Crédito' })).toBeInTheDocument()
  const user = userEvent.setup()
  const plazo = screen.getByLabelText('Plazo máximo (cuotas)') as HTMLInputElement
  const previousPlazo = Number(plazo.value)
  await user.click(screen.getByRole('button', { name: 'Agregar una cuota' }))
  expect(plazo).toHaveValue(String(previousPlazo + 1))
  await user.click(screen.getByRole('button', { name: 'Guardar crédito' }))
  await waitFor(() => expect(creditSettingsWrites.length).toBeGreaterThan(writesBefore))
  return {
    previousPlazo,
    nextPlazo: previousPlazo + 1,
    body: creditSettingsWrites.at(-1)?.body as Record<string, unknown>,
  }
}

async function putAfterChangingPlazoOnly() {
  const got = await getCreditSettings(businesses.norte.id)
  await putCreditSettings(businesses.norte.id, {
    ...got,
    max_installments: got.max_installments + 1,
  })
  return {
    got,
    nextPlazo: got.max_installments + 1,
    body: creditSettingsWrites.at(-1)?.body as Record<string, unknown>,
  }
}

describe('CBF-218 reenvío de mora al guardar crédito', () => {
  it('1a GET mora porcentaje (gracia y tope) → cambiar solo el plazo → PUT idéntico en los 5 campos', async () => {
    seedCreditSettings(MORA_PERCENT)
    loginOwner()
    const { got, body, nextPlazo } = await putAfterChangingPlazoOnly()
    expect(lateFeesOf(got)).toEqual(MORA_PERCENT)
    expect(lateFeesOf(body)).toEqual(MORA_PERCENT)
    expectExactWriteKeys(body)
    expect(body.max_installments).toBe(nextPlazo)

    const ui = await saveAfterChangingPlazoOnly()
    expect(lateFeesOf(ui.body)).toEqual(MORA_PERCENT)
    expect(ui.body.max_installments).toBe(ui.nextPlazo)
  })

  it('1b GET mora monto fijo con gracia y tope → cambiar solo el plazo → PUT idéntico', async () => {
    seedCreditSettings(MORA_FIXED_WITH_CAP)
    loginOwner()
    const { got, body } = await putAfterChangingPlazoOnly()
    expect(lateFeesOf(got)).toEqual(MORA_FIXED_WITH_CAP)
    expect(lateFeesOf(body)).toEqual(MORA_FIXED_WITH_CAP)
    expectExactWriteKeys(body)

    const ui = await saveAfterChangingPlazoOnly()
    expect(lateFeesOf(ui.body)).toEqual(MORA_FIXED_WITH_CAP)
  })

  it('1c GET mora monto fijo con gracia y sin tope → cambiar solo el plazo → PUT idéntico', async () => {
    seedCreditSettings(MORA_FIXED_NO_CAP)
    loginOwner()
    const { got, body } = await putAfterChangingPlazoOnly()
    expect(lateFeesOf(got)).toEqual(MORA_FIXED_NO_CAP)
    expect(lateFeesOf(body)).toEqual(MORA_FIXED_NO_CAP)
    expectExactWriteKeys(body)

    const ui = await saveAfterChangingPlazoOnly()
    expect(lateFeesOf(ui.body)).toEqual(MORA_FIXED_NO_CAP)
  })

  it('2 GET mora nula → cambiar el plazo → PUT manda nulos y gracia 0 sin activar mora', async () => {
    seedCreditSettings(MORA_OFF)
    loginOwner()
    const { got, body } = await putAfterChangingPlazoOnly()
    expect(lateFeesOf(got)).toEqual(MORA_OFF)
    expect(lateFeesOf(body)).toEqual(MORA_OFF)
    expect(body.late_fee_kind).toBeNull()
    expect(body.late_fee_percent).toBeNull()
    expect(body.late_fee_fixed).toBeNull()
    expect(body.late_fee_cap).toBeNull()
    expect(body.late_fee_grace_days).toBe(0)

    const ui = await saveAfterChangingPlazoOnly()
    expect(lateFeesOf(ui.body)).toEqual(MORA_OFF)
  })

  it('3 el PUT tiene las 7 claves de hoy + exactamente los 5 de mora', async () => {
    seedCreditSettings(MORA_PERCENT)
    loginOwner()
    const { body } = await putAfterChangingPlazoOnly()
    expectExactWriteKeys(body)
    expect(LATE_FEE_FIELDS).toHaveLength(5)

    const ui = await saveAfterChangingPlazoOnly()
    expectExactWriteKeys(ui.body)
  })

  it('4 cambiar solo el plazo deja mora idéntica al GET; recargo y plazo no se alteran por reenviar mora', async () => {
    seedCreditSettings({
      ...MORA_PERCENT,
      surcharge_kind: 'percent_of_financed',
      surcharge_percent: '20.00',
      surcharge_amount: null,
      max_installments: 24,
    })
    loginOwner()
    const { got, body, nextPlazo } = await putAfterChangingPlazoOnly()
    expect(lateFeesOf(body)).toEqual(lateFeesOf(got))
    expect(body.surcharge_kind).toBe(got.surcharge_kind)
    expect(body.surcharge_percent).toBe(got.surcharge_percent)
    expect(body.surcharge_amount).toBe(got.surcharge_amount)
    expect(body.max_installments).toBe(nextPlazo)
    expect(got.max_installments).toBe(24)
    expect(got.surcharge_percent).toBe('20.00')

    const ui = await saveAfterChangingPlazoOnly()
    expect(lateFeesOf(ui.body)).toEqual(MORA_PERCENT)
    expect(ui.body.surcharge_kind).toBe('percent_of_financed')
    expect(ui.body.surcharge_percent).toBe('20.00')
    expect(ui.body.surcharge_amount).toBeNull()
    expect(ui.body.max_installments).toBe(ui.nextPlazo)
    expect(screen.getByLabelText('Recargo')).toHaveValue('20.00')
    expect(screen.getByLabelText('Plazo máximo (cuotas)')).toHaveValue(String(ui.nextPlazo))
  })

  it("5 no reformatea strings: '12.5' y '150.00' siguen iguales; null sigue null", async () => {
    seedCreditSettings({
      late_fee_kind: 'percent',
      late_fee_percent: '12.5',
      late_fee_fixed: '150.00',
      late_fee_grace_days: 3,
      late_fee_cap: null,
    })
    loginOwner()
    const { got, body } = await putAfterChangingPlazoOnly()
    expect(got.late_fee_percent).toBe('12.5')
    expect(got.late_fee_fixed).toBe('150.00')
    expect(got.late_fee_cap).toBeNull()
    expect(body.late_fee_percent).toBe('12.5')
    expect(body.late_fee_fixed).toBe('150.00')
    expect(body.late_fee_cap).toBeNull()
    expect(body.late_fee_percent).not.toBe(12.5)
    expect(body.late_fee_fixed).not.toBe(150)
    expect(Object.is(body.late_fee_cap, null)).toBe(true)

    const normalized = normalizeCreditSettings({
      interest_method: 'recargo_fijo',
      surcharge_kind: 'percent_of_financed',
      surcharge_percent: '20.00',
      surcharge_amount: null,
      allowed_frequencies: ['mensual'],
      max_installments: 24,
      min_down_payment_percent: null,
      late_fee_kind: 'percent',
      late_fee_percent: '12.5',
      late_fee_fixed: '150.00',
      late_fee_grace_days: 3,
      late_fee_cap: null,
    })
    expect(normalized.late_fee_percent).toBe('12.5')
    expect(normalized.late_fee_fixed).toBe('150.00')
    expect(normalized.late_fee_cap).toBeNull()
    expect(toCreditSettingsWrite(normalized).late_fee_percent).toBe('12.5')
    expect(toCreditSettingsWrite(normalized).late_fee_fixed).toBe('150.00')
    expect(toCreditSettingsWrite(normalized).late_fee_cap).toBeNull()
  })

  it('si el GET no trae mora (backend viejo) el PUT no inventa ni envía esos campos', async () => {
    loginOwner()
    const got = await getCreditSettings(businesses.norte.id)
    for (const key of LATE_FEE_FIELDS) {
      expect(got).not.toHaveProperty(key)
    }
    const write = toCreditSettingsWrite({ ...got, max_installments: got.max_installments + 1 })
    for (const key of LATE_FEE_FIELDS) {
      expect(write).not.toHaveProperty(key)
    }
    expect(
      buildCreditSettingsWrite(
        {
          surcharge_kind: 'percent_of_financed',
          surcharge_percent: '20.00',
          surcharge_amount: '',
          allowed_frequencies: ['mensual'],
          max_installments: 12,
          min_down_payment_percent: '',
        },
        got,
      ),
    ).not.toHaveProperty('late_fee_kind')

    server.use(
      http.get('*/businesses/:id/credit-settings', () =>
        HttpResponse.json({
          interest_method: 'recargo_fijo',
          surcharge_kind: 'percent_of_financed',
          surcharge_percent: '20.00',
          surcharge_amount: null,
          allowed_frequencies: ['semanal', 'quincenal', 'mensual'],
          max_installments: 24,
          min_down_payment_percent: '10.00',
          configured: true,
        }),
      ),
    )
    const ui = await saveAfterChangingPlazoOnly()
    for (const key of LATE_FEE_FIELDS) {
      expect(ui.body).not.toHaveProperty(key)
    }
    expect(Object.keys(ui.body).sort()).toEqual(
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

  it('no reenvía nombres de BD ni campos extra del GET', async () => {
    loginOwner()
    server.use(
      http.get('*/businesses/:id/credit-settings', () =>
        HttpResponse.json({
          interest_method: 'recargo_fijo',
          surcharge_kind: 'percent_of_financed',
          surcharge_percent: '20.00',
          surcharge_amount: null,
          allowed_frequencies: ['mensual'],
          max_installments: 24,
          min_down_payment_percent: null,
          configured: true,
          late_fee_kind: 'percent',
          late_fee_percent: '12.5',
          late_fee_fixed: null,
          late_fee_grace_days: 3,
          late_fee_cap: '500.00',
          late_fee_percent_bp: 1250,
          late_fee_fixed_cents: 15000,
          late_fee_cap_cents: 50000,
          mystery_field: 'no',
        }),
      ),
    )
    const got = await getCreditSettings(businesses.norte.id)
    expect(got).not.toHaveProperty('late_fee_percent_bp')
    expect(got).not.toHaveProperty('late_fee_fixed_cents')
    expect(got).not.toHaveProperty('late_fee_cap_cents')
    expect(got).not.toHaveProperty('mystery_field')
    const write = toCreditSettingsWrite(got)
    expectExactWriteKeys(write as Record<string, unknown>)
    await putCreditSettings(businesses.norte.id, { ...got, max_installments: 30 })
    const body = creditSettingsWrites.at(-1)?.body as Record<string, unknown>
    expectExactWriteKeys(body)
  })
})
