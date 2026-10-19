import { useState } from 'react'

import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { MoneyInput } from '@/features/sales/components/money-input'
import { SegmentedControl } from '@/features/sales/components/segmented-control'
import { Stepper } from '@/features/sales/components/stepper'
import {
  useBusiness,
  useCreditSettings,
  usePatchBusinessMutation,
  usePutCreditSettingsMutation,
} from '@/features/sales/hooks/use-sales-queries'
import { displayPercent, formatFieldMessage } from '@/features/sales/lib/copy'
import { buildCreditSettingsWrite } from '@/features/sales/services/requests'
import {
  FREQUENCIES,
  type CreditSettings,
  type Frequency,
  type SurchargeKind,
} from '@/features/sales/services/types'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, FieldError, TextArea, TextInput } from '@/features/shared/components/ui/field'
import { getFieldErrors, isApiError } from '@/features/shared/lib/api-error'
import { cn } from '@/features/shared/lib/cn'
import { formatMoney } from '@/features/shared/lib/format-money'
import { canConfigureCredit } from '@/features/shared/lib/roles'

const FREQUENCY_LABEL: Record<Frequency, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

const CREDIT_EXAMPLE =
  'Ejemplo fijo: con 20 %, un saldo de RD$ 15,000.00 lleva RD$ 3,000.00 de recargo.'

type CreditForm = {
  kind: SurchargeKind
  percent: string
  amount: string
  frequencies: Frequency[]
  maxInstallments: number
  minDown: string
}

type LegalForm = {
  rnc: string
  address: string
}

function creditFormFromSettings(data: CreditSettings): CreditForm {
  return {
    kind: data.surcharge_kind,
    percent: data.surcharge_percent ?? '',
    amount: data.surcharge_amount ?? '',
    frequencies: data.allowed_frequencies.length
      ? data.allowed_frequencies
      : [...FREQUENCIES],
    maxInstallments: data.max_installments,
    minDown: data.min_down_payment_percent ?? '',
  }
}

const EMPTY_CREDIT: CreditForm = {
  kind: 'percent_of_financed',
  percent: '',
  amount: '',
  frequencies: [...FREQUENCIES],
  maxInstallments: 52,
  minDown: '',
}

export function BusinessSettingsPage() {
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const canEdit = canConfigureCredit(role)
  const settings = useCreditSettings()
  const business = useBusiness()
  const saveCredit = usePutCreditSettingsMutation()
  const saveBusiness = usePatchBusinessMutation()

  const [creditDraft, setCreditDraft] = useState<CreditForm | null>(null)
  const [legalDraft, setLegalDraft] = useState<LegalForm | null>(null)
  const [creditNotice, setCreditNotice] = useState(false)
  const [legalNotice, setLegalNotice] = useState(false)

  const credit = creditDraft ?? (settings.data ? creditFormFromSettings(settings.data) : EMPTY_CREDIT)
  const kind = credit.kind
  const percent = credit.percent
  const amount = credit.amount
  const frequencies = credit.frequencies
  const maxInstallments = credit.maxInstallments
  const minDown = credit.minDown
  const rnc = legalDraft?.rnc ?? business.data?.rnc ?? ''
  const address = legalDraft?.address ?? business.data?.address ?? ''

  function patchCredit(patch: Partial<CreditForm>) {
    setCreditDraft({ ...credit, ...patch })
    setCreditNotice(false)
  }

  const creditFields = saveCredit.isError ? getFieldErrors(saveCredit.error) : {}
  const legalFields = saveBusiness.isError ? getFieldErrors(saveBusiness.error) : {}
  const creditBanner =
    saveCredit.isError && Object.keys(creditFields).length === 0
      ? isApiError(saveCredit.error)
        ? formatFieldMessage(saveCredit.error.message)
        : 'No se pudo guardar.'
      : null
  const legalBanner =
    saveBusiness.isError && Object.keys(legalFields).length === 0
      ? isApiError(saveBusiness.error)
        ? formatFieldMessage(saveBusiness.error.message)
        : 'No se pudo guardar.'
      : null

  const loadError = settings.isError || business.isError
  const loading = settings.isPending || business.isPending
  // CBF-207: banner only when configured === false. If the field is missing (old backend), hide it.
  const configured = settings.data?.configured
  const missingLegal = !(business.data?.rnc && business.data?.address)

  function toggleFrequency(item: Frequency) {
    patchCredit({
      frequencies: frequencies.includes(item)
        ? frequencies.filter((row) => row !== item)
        : [...frequencies, item],
    })
  }

  if (loading) {
    return (
      <div aria-busy="true">
        <p>Cargando…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <Alert
        icon="✕"
        title="No se pudo cargar la configuración."
        action={
          <Button
            variant="outline"
            onClick={() => {
              void settings.refetch()
              void business.refetch()
            }}
          >
            Reintentar
          </Button>
        }
      >
        Revisa tu conexión e inténtalo de nuevo.
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Negocio"
        description="Reglas de crédito y datos que salen en el contrato."
      />

      {creditNotice || legalNotice ? (
        <Alert tone="success" icon="✓" title="Listo, configuración guardada." />
      ) : null}

      {configured === false ? (
        <Alert
          tone="warning"
          icon="⚠"
          title={
            canEdit
              ? 'Aún no has configurado el crédito.'
              : 'El crédito aún no está configurado. Pídele al dueño que lo configure.'
          }
        >
          Mientras tanto, el simulador usa recargo 0 % y no se pueden registrar ventas.
        </Alert>
      ) : null}

      {canEdit ? (
        <>
          <section className="border-border flex flex-col gap-4 rounded-md border p-4">
            <h2 className="m-0 text-lg">Crédito</h2>
            {creditBanner ? <Alert>{creditBanner}</Alert> : null}
            <Field id="surcharge-kind" label="Tipo de recargo">
              <SegmentedControl
                label="Tipo de recargo"
                value={kind}
                options={[
                  { value: 'percent_of_financed', label: 'Porcentaje' },
                  { value: 'fixed_amount', label: 'Monto fijo' },
                ]}
                onChange={(value) => patchCredit({ kind: value })}
              />
              <p className="text-text m-0 text-sm">
                Se aplica una sola vez sobre el saldo financiado.
              </p>
            </Field>
            {kind === 'percent_of_financed' ? (
              <Field
                id="surcharge-percent"
                label="Recargo"
                error={fieldMessage(creditFields.surcharge_percent ?? creditFields.surcharge_kind)}
                hint={CREDIT_EXAMPLE}
              >
                <div className="relative">
                  <TextInput
                    id="surcharge-percent"
                    inputMode="decimal"
                    className="tabular-nums pr-10"
                    value={percent}
                    error={creditFields.surcharge_percent}
                    onChange={(event) => patchCredit({ percent: event.target.value })}
                  />
                  <span className="text-text pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                    %
                  </span>
                </div>
              </Field>
            ) : (
              <Field
                id="surcharge-amount"
                label="Recargo"
                error={fieldMessage(creditFields.surcharge_amount ?? creditFields.surcharge_kind)}
              >
                <MoneyInput
                  id="surcharge-amount"
                  value={amount}
                  onValue={(value) => patchCredit({ amount: value })}
                  error={creditFields.surcharge_amount}
                />
              </Field>
            )}
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend className="text-heading text-sm font-medium">Frecuencias permitidas</legend>
              {creditFields.allowed_frequencies ? (
                <FieldError>{fieldMessage(creditFields.allowed_frequencies)}</FieldError>
              ) : null}
              {FREQUENCIES.map((item) => {
                const on = frequencies.includes(item)
                return (
                  <label
                    key={item}
                    className={cn(
                      'border-border flex min-h-11 items-center gap-2.5 rounded-md border px-3',
                      on && 'border-accent bg-accent-bg',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex size-5 items-center justify-center rounded border-2 text-xs',
                        on
                          ? 'border-accent bg-accent text-accent-fg'
                          : 'border-border',
                      )}
                      aria-hidden
                    >
                      {on ? '✓' : ''}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => toggleFrequency(item)}
                    />
                    {FREQUENCY_LABEL[item]}
                  </label>
                )
              })}
            </fieldset>
            <Field
              id="max-installments"
              label="Plazo máximo (cuotas)"
              error={fieldMessage(creditFields.max_installments)}
            >
              <Stepper
                id="max-installments"
                value={maxInstallments}
                min={1}
                max={520}
                onChange={(value) => patchCredit({ maxInstallments: value })}
                error={creditFields.max_installments}
              />
            </Field>
            <Field
              id="min-down"
              label="Inicial mínima (opcional)"
              error={fieldMessage(creditFields.min_down_payment_percent)}
              hint="Déjalo vacío si no exiges inicial."
            >
              <div className="relative">
                <TextInput
                  id="min-down"
                  inputMode="decimal"
                  className="tabular-nums pr-10"
                  value={minDown}
                  error={creditFields.min_down_payment_percent}
                  onChange={(event) => patchCredit({ minDown: event.target.value })}
                />
                <span className="text-text pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                  %
                </span>
              </div>
            </Field>
            <Button
              variant="primary"
              className="min-h-12 w-full"
              disabled={saveCredit.isPending}
              onClick={() => {
                setCreditNotice(false)
                saveCredit.mutate(
                  buildCreditSettingsWrite({
                    surcharge_kind: kind,
                    surcharge_percent: percent,
                    surcharge_amount: amount,
                    allowed_frequencies: frequencies,
                    max_installments: maxInstallments,
                    min_down_payment_percent: minDown,
                  }),
                  {
                    onSuccess: () => {
                      setCreditDraft(null)
                      setCreditNotice(true)
                    },
                  },
                )
              }}
            >
              {saveCredit.isPending ? 'Guardando…' : 'Guardar crédito'}
            </Button>
          </section>

          <section className="border-border flex flex-col gap-4 rounded-md border p-4">
            <h2 className="m-0 text-lg">Datos para el contrato</h2>
            {legalBanner ? <Alert>{legalBanner}</Alert> : null}
            <Field
              id="rnc"
              label="RNC"
              error={fieldMessage(legalFields.rnc)}
              hint="Obligatorio para registrar ventas."
            >
              <TextInput
                id="rnc"
                inputMode="numeric"
                className="tabular-nums"
                placeholder="Ej.: 131234567"
                value={rnc}
                error={legalFields.rnc}
                onChange={(event) => {
                  setLegalDraft({ rnc: event.target.value, address })
                  setLegalNotice(false)
                }}
              />
            </Field>
            <Field id="address" label="Dirección" error={fieldMessage(legalFields.address)}>
              <TextArea
                id="address"
                rows={2}
                placeholder="Calle, número, sector, ciudad"
                value={address}
                error={legalFields.address}
                onChange={(event) => {
                  setLegalDraft({ rnc, address: event.target.value })
                  setLegalNotice(false)
                }}
              />
            </Field>
            <Button
              variant="primary"
              className="min-h-12 w-full"
              disabled={saveBusiness.isPending}
              onClick={() => {
                setLegalNotice(false)
                saveBusiness.mutate(
                  { rnc: rnc.trim() || null, address: address.trim() || null },
                  {
                    onSuccess: () => {
                      setLegalDraft(null)
                      setLegalNotice(true)
                    },
                  },
                )
              }}
            >
              {saveBusiness.isPending ? 'Guardando…' : 'Guardar datos'}
            </Button>
          </section>
        </>
      ) : (
        <CashierReadOnly
          recargo={recargoReadOnly(settings.data)}
          frequencies={settings.data?.allowed_frequencies ?? []}
          maxInstallments={settings.data?.max_installments ?? 0}
          minDown={settings.data?.min_down_payment_percent ?? null}
          rnc={business.data?.rnc ?? null}
          address={business.data?.address ?? null}
          missingLegal={missingLegal}
        />
      )}
    </div>
  )
}

function fieldMessage(message?: string): string | undefined {
  return message ? formatFieldMessage(message) : undefined
}

function recargoReadOnly(settings: ReturnType<typeof useCreditSettings>['data']): string {
  if (!settings) return '—'
  if (settings.surcharge_kind === 'fixed_amount' && settings.surcharge_amount) {
    return `${formatMoney(settings.surcharge_amount)} (monto fijo)`
  }
  if (settings.surcharge_percent) {
    return `${displayPercent(settings.surcharge_percent)} del saldo financiado`
  }
  return '—'
}

function CashierReadOnly({
  recargo,
  frequencies,
  maxInstallments,
  minDown,
  rnc,
  address,
  missingLegal,
}: {
  recargo: string
  frequencies: Frequency[]
  maxInstallments: number
  minDown: string | null
  rnc: string | null
  address: string | null
  missingLegal: boolean
}) {
  const freqLabel = frequencies
    .map((item, index) => {
      const word = FREQUENCY_LABEL[item]
      if (index === 0) return word
      return word.toLowerCase()
    })
    .join(', ')
  return (
    <>
      <section className="border-border flex flex-col gap-2 rounded-md border p-4">
        <h2 className="m-0 text-lg">Crédito</h2>
        <ReadRow label="Recargo" value={recargo} />
        <ReadRow label="Frecuencias" value={freqLabel || '—'} />
        <ReadRow label="Plazo máximo" value={`${maxInstallments} cuotas`} />
        <ReadRow
          label="Inicial mínima"
          value={minDown ? displayPercent(minDown) : 'No exige'}
          last
        />
        <p className="m-0 text-sm">Solo el dueño puede cambiar esta configuración.</p>
      </section>
      <section className="border-border flex flex-col gap-2 rounded-md border p-4">
        <h2 className="m-0 text-lg">Datos para el contrato</h2>
        <ReadRow label="RNC" value={rnc || '—'} />
        <ReadRow label="Dirección" value={address || '—'} last />
        {missingLegal ? (
          <Alert
            tone="warning"
            icon="⚠"
            title="Falta el RNC o la dirección."
          >
            Pídele al dueño que los complete.
          </Alert>
        ) : null}
      </section>
    </>
  )
}

function ReadRow({
  label,
  value,
  last = false,
}: {
  label: string
  value: string
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'flex justify-between py-1.5',
        !last && 'border-border border-b border-dashed',
      )}
    >
      <span>{label}</span>
      <b className="text-heading font-medium tabular-nums">{value}</b>
    </div>
  )
}
