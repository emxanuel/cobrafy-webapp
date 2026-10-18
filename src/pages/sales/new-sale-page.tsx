import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import type { Role } from '@/features/auth/services/types'
import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { useClient } from '@/features/clients/hooks/use-clients-queries'
import { displayFreeText, formatDocumentLine } from '@/features/clients/lib/display-document'
import { Badge } from '@/features/shared/components/ui/badge'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button, buttonVariants } from '@/features/shared/components/ui/button'
import { Field, TextInput } from '@/features/shared/components/ui/field'
import { LoadingState } from '@/features/shared/components/ui/loading-state'
import { getApiErrorMessage, getFieldErrors, isApiError } from '@/features/shared/lib/api-error'
import { formatDueDate } from '@/features/shared/lib/format-due-date'
import { formatMoney } from '@/features/shared/lib/format-money'
import { FirstDuePicker } from '@/features/sales/components/first-due-picker'
import { MoneyInput, MONEY_INVALID_MESSAGE } from '@/features/sales/components/money-input'
import { PlanCard } from '@/features/sales/components/plan-card'
import { SaleBanner } from '@/features/sales/components/sale-banner'
import { SegmentedControl } from '@/features/sales/components/segmented-control'
import { Stepper } from '@/features/sales/components/stepper'
import { StickyActionBar } from '@/features/sales/components/sticky-action-bar'
import { BottomSheet } from '@/features/sales/components/bottom-sheet'
import { CuotaDots } from '@/features/sales/components/cuota-dots'
import {
  useCreateSaleMutation,
  useCreditSettings,
  useSimulateSale,
} from '@/features/sales/hooks/use-sales-queries'
import { quincenalOptions } from '@/features/sales/lib/calendar'
import {
  IDEMPOTENCY_REUSED_BODY,
  IDEMPOTENCY_REUSED_TITLE,
  confirmBlockedReason,
  formatFieldMessage,
  frequencyAdjective,
  saleErrorBanner,
  simulatorWarningCopy,
  surchargeLabel,
} from '@/features/sales/lib/copy'
import { idempotencyForForm, type IdempotencyState } from '@/features/sales/lib/idempotency'
import { isPositiveAmount } from '@/features/sales/lib/money-input'
import {
  buildSaleCreateBody,
  saleFormFingerprint,
  salePayloadFingerprint,
  type SaleFormSnapshot,
} from '@/features/sales/lib/sale-payload'
import { planCuotaCount, planFirstDue, planLastDue } from '@/features/sales/lib/plan-view'
import {
  FREQUENCIES,
  type Frequency,
  type SaleCreateRequest,
  type SaleDetail,
} from '@/features/sales/services/types'
import { SaleRegistered } from '@/pages/sales/sale-registered'

const FREQUENCY_LABEL: Record<Frequency, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

export function NewSalePage() {
  const { clientId = '' } = useParams()
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const clientQuery = useClient(clientId)
  const settingsQuery = useCreditSettings()

  if (clientQuery.isPending) {
    return (
      <LoadingState>
        <p>Cargando ficha…</p>
      </LoadingState>
    )
  }

  if (clientQuery.isError) {
    const status = isApiError(clientQuery.error) ? clientQuery.error.status : 0
    if (status === 404) {
      return <Alert>Este cliente no existe o ya no está disponible.</Alert>
    }
    if (status === 403) {
      return <Alert>No tienes permiso para registrar ventas.</Alert>
    }
    return <Alert>{getApiErrorMessage(clientQuery.error)}</Alert>
  }

  const settings = settingsQuery.data
  const allowed = settings?.allowed_frequencies.length
    ? settings.allowed_frequencies
    : [...FREQUENCIES]
  const maxInstallments = settings?.max_installments ?? 24
  const minDown = settings?.min_down_payment_percent

  return (
    <NewSaleForm
      key={`${activeBusinessId}-${clientId}`}
      clientId={clientId}
      clientName={clientQuery.data.name}
      docType={clientQuery.data.doc_type}
      document={clientQuery.data.document}
      clientBlocked={clientQuery.data.is_blocked || clientQuery.data.status === 'blocked'}
      blockedReason={clientQuery.data.blocked_reason}
      role={role}
      allowed={allowed}
      maxInstallments={maxInstallments}
      minDown={minDown}
      surchargeKind={settings?.surcharge_kind ?? 'percent_of_financed'}
      surchargePercent={settings?.surcharge_percent ?? null}
    />
  )
}

function NewSaleForm({
  clientId,
  clientName,
  docType,
  document,
  clientBlocked,
  blockedReason,
  role,
  allowed,
  maxInstallments,
  minDown,
  surchargeKind,
  surchargePercent,
}: {
  clientId: string
  clientName: string
  docType: 'cedula' | 'pasaporte'
  document: string | null
  clientBlocked: boolean
  blockedReason: string | null
  role: Role | null
  allowed: Frequency[]
  maxInstallments: number
  minDown: string | null | undefined
  surchargeKind: string
  surchargePercent: string | null
}) {
  const [article, setArticle] = useState('')
  const [price, setPrice] = useState('')
  const [down, setDown] = useState('0.00')
  const [installments, setInstallments] = useState(
    maxInstallments < 12 ? maxInstallments : 12,
  )
  const [frequency, setFrequency] = useState<Frequency>(
    allowed.includes('mensual') ? 'mensual' : (allowed[0] ?? 'mensual'),
  )
  const [firstDue, setFirstDue] = useState('')
  const [debounced, setDebounced] = useState<SaleFormSnapshot | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [created, setCreated] = useState<SaleDetail | null>(null)
  const [priceInvalid, setPriceInvalid] = useState(false)
  const [downInvalid, setDownInvalid] = useState(false)
  const [idempotencyReused, setIdempotencyReused] = useState(false)
  const [lastSubmitted, setLastSubmitted] = useState<{
    payload: SaleCreateRequest
    key: string
    snapshot: SaleFormSnapshot
  } | null>(null)
  const idempotencyRef = useRef<IdempotencyState | null>(null)
  const inFlightRef = useRef(false)
  const bannerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const snapshot: SaleFormSnapshot = useMemo(
    () => ({
      client_id: clientId,
      item_description: article.trim(),
      price,
      down_payment: down || '0.00',
      installments,
      frequency,
      first_due_date: firstDue,
    }),
    [article, clientId, down, firstDue, frequency, installments, price],
  )

  const fingerprint = saleFormFingerprint(snapshot)
  const canSimulate =
    isPositiveAmount(price) &&
    !priceInvalid &&
    !downInvalid &&
    installments >= 1 &&
    Boolean(frequency)
  const pendingSnapshot = canSimulate ? snapshot : null

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(pendingSnapshot), 400)
    return () => window.clearTimeout(timer)
  }, [pendingSnapshot])

  const simulatePayload = debounced
    ? {
        client_id: clientId,
        price: debounced.price,
        down_payment: debounced.down_payment,
        installments: debounced.installments,
        frequency: debounced.frequency,
        ...(debounced.first_due_date ? { first_due_date: debounced.first_due_date } : {}),
      }
    : null

  const simulate = useSimulateSale(clientId, canSimulate ? simulatePayload : null)
  const create = useCreateSaleMutation(clientId)
  const plan = simulate.data
  const simulating = simulate.isFetching || (canSimulate && debounced !== snapshot)
  const stale = !plan || saleFormFingerprint({
    ...snapshot,
    price: plan ? snapshot.price : '',
  }) !== fingerprint || !simulatePayload ||
    simulatePayload.price !== snapshot.price ||
    simulatePayload.down_payment !== snapshot.down_payment ||
    simulatePayload.installments !== snapshot.installments ||
    simulatePayload.frequency !== snapshot.frequency ||
    (simulatePayload.first_due_date ?? '') !== snapshot.first_due_date

  const ready = Boolean(plan) && !simulating && !stale
  const pickerDue = firstDue || (plan ? planFirstDue(plan) : '')

  const fieldErrors = simulate.isError ? getFieldErrors(simulate.error) : {}
  const simulateCode = isApiError(simulate.error) ? simulate.error.code : undefined
  const simulateStatus = isApiError(simulate.error) ? simulate.error.status : 0
  const createFieldErrors = create.isError ? getFieldErrors(create.error) : {}
  const mergedFields = { ...fieldErrors, ...createFieldErrors }
  const createCode = isApiError(create.error) ? create.error.code : undefined
  const createStatus = isApiError(create.error) ? create.error.status : 0

  const settingsMissing =
    plan?.settings_configured === false ||
    plan?.warnings.some((item) => item.code === 'settings_configured' || item.code === 'CREDIT_SETTINGS_MISSING') ||
    simulateCode === 'CREDIT_SETTINGS_MISSING' ||
    createCode === 'CREDIT_SETTINGS_MISSING'
  const legalMissing =
    plan?.warnings.some((item) => item.code === 'legal_data_missing' || item.code === 'BUSINESS_LEGAL_DATA_MISSING') ||
    simulateCode === 'BUSINESS_LEGAL_DATA_MISSING' ||
    createCode === 'BUSINESS_LEGAL_DATA_MISSING'
  const blockedFromSim =
    clientBlocked ||
    plan?.warnings.some((item) => item.code === 'client_blocked' || item.code === 'CLIENT_BLOCKED') ||
    simulateCode === 'CLIENT_BLOCKED' ||
    createCode === 'CLIENT_BLOCKED'

  const articleValid = article.trim().length >= 1 && article.trim().length <= 500
  const blockReason = confirmBlockedReason(
    { settingsMissing, clientBlocked: blockedFromSim, legalMissing },
    role,
  )
  const hasFieldError = Object.keys(mergedFields).length > 0
  const confirmDisabled =
    !articleValid ||
    !isPositiveAmount(price) ||
    priceInvalid ||
    downInvalid ||
    installments < 1 ||
    !ready ||
    Boolean(blockReason) ||
    hasFieldError ||
    simulate.isError ||
    create.isPending

  let confirmHint = ''
  if (priceInvalid || downInvalid) {
    confirmHint = MONEY_INVALID_MESSAGE
  } else if (!isPositiveAmount(price) || installments < 1 || !articleValid) {
    confirmHint = 'Completa precio, plazo y artículo para continuar.'
  } else if (simulating || stale) {
    confirmHint = 'Espera a que termine el cálculo.'
  } else if (blockReason) {
    confirmHint = blockReason
  }

  const formChangedSinceSubmit =
    lastSubmitted != null && saleFormFingerprint(lastSubmitted.snapshot) !== fingerprint
  const registerFailed =
    create.isError &&
    (createStatus === 0 || createStatus >= 500) &&
    createCode !== 'IDEMPOTENCY_KEY_REUSED' &&
    lastSubmitted != null
  const canRetryNetwork = registerFailed && !formChangedSinceSubmit

  const banners: ReturnType<typeof simulatorWarningCopy>[] = []
  if (blockedFromSim) {
    banners.push(
      simulatorWarningCopy(
        'client_blocked',
        role,
        clientId,
        blockedReason
          ? `Este cliente está bloqueado: ${displayFreeText(blockedReason, role)}`
          : isApiError(create.error) || isApiError(simulate.error)
            ? getApiErrorMessage(create.error ?? simulate.error)
            : undefined,
      ),
    )
  }
  if (settingsMissing) {
    banners.push(simulatorWarningCopy('settings_configured', role, clientId))
  }
  if (legalMissing) {
    banners.push(simulatorWarningCopy('legal_data_missing', role, clientId))
  }
  const extraWarnings = (plan?.warnings ?? []).filter(
    (item) =>
      item.code !== 'client_blocked' &&
      item.code !== 'CLIENT_BLOCKED' &&
      item.code !== 'settings_configured' &&
      item.code !== 'CREDIT_SETTINGS_MISSING' &&
      item.code !== 'legal_data_missing' &&
      item.code !== 'BUSINESS_LEGAL_DATA_MISSING',
  )
  for (const warning of extraWarnings) {
    banners.push(simulatorWarningCopy(warning.code, role, clientId, warning.message))
  }

  const registerBanner =
    create.isError &&
    createStatus === 409 &&
    createCode !== 'IDEMPOTENCY_KEY_REUSED'
      ? saleErrorBanner(
          createCode,
          role,
          clientId,
          createCode === 'CLIENT_BLOCKED'
            ? getApiErrorMessage(create.error)
            : getApiErrorMessage(create.error),
        )
      : simulate.isError && simulateStatus === 409
        ? saleErrorBanner(simulateCode, role, clientId, getApiErrorMessage(simulate.error))
        : null

  function changeFrequency(next: Frequency) {
    setFrequency(next)
    setFirstDue('')
    if (next === 'quincenal') {
      const first = quincenalOptions()[0]
      if (first) setFirstDue(first.iso)
    }
  }

  function closeConfirm() {
    if (create.isPending) return
    setConfirmOpen(false)
    setIdempotencyReused(false)
  }

  function openConfirm() {
    if (confirmDisabled || !plan) return
    setIdempotencyReused(false)
    setConfirmOpen(true)
  }

  function finishCreate(error?: unknown) {
    inFlightRef.current = false
    if (!error) return
    if (isApiError(error) && error.code === 'IDEMPOTENCY_KEY_REUSED') {
      idempotencyRef.current = null
      setIdempotencyReused(true)
      if (!confirmOpen) {
        queueMicrotask(() => bannerRef.current?.focus())
      }
      return
    }
    setConfirmOpen(false)
    queueMicrotask(() => bannerRef.current?.focus())
  }

  function submitSale() {
    if (confirmDisabled || !plan || !ready || create.isPending || inFlightRef.current) return
    const payload = buildSaleCreateBody(snapshot, plan)
    const payloadFingerprint = salePayloadFingerprint(payload)
    const next = idempotencyForForm(idempotencyRef.current, payloadFingerprint)
    idempotencyRef.current = next
    setLastSubmitted({ payload, key: next.key, snapshot })
    setIdempotencyReused(false)
    inFlightRef.current = true
    create.mutate(
      { payload, idempotencyKey: next.key },
      {
        onSuccess: (sale) => {
          inFlightRef.current = false
          setConfirmOpen(false)
          setCreated(sale)
        },
        onError: finishCreate,
      },
    )
  }

  function retryLastSubmitted() {
    if (!lastSubmitted || create.isPending || inFlightRef.current || formChangedSinceSubmit) return
    inFlightRef.current = true
    create.mutate(
      { payload: lastSubmitted.payload, idempotencyKey: lastSubmitted.key },
      {
        onSuccess: (sale) => {
          inFlightRef.current = false
          setConfirmOpen(false)
          setCreated(sale)
        },
        onError: finishCreate,
      },
    )
  }

  if (created) {
    return <SaleRegistered sale={created} role={role} />
  }

  const planState = !canSimulate
    ? 'idle'
    : hasFieldError && simulate.isError
      ? 'field-error'
      : simulating && !plan
        ? 'calculating'
        : simulating
          ? 'calculating'
          : 'result'

  return (
    <div className="flex flex-col gap-5 pb-36">
      <div>
        <Link
          to={`/clientes/${clientId}`}
          className="text-accent inline-flex min-h-11 items-center no-underline"
        >
          ‹ Volver a la ficha
        </Link>
        <h1 className="m-0 text-3xl tracking-tight">Nueva venta</h1>
        <p className="mt-1">Calcula las cuotas con el cliente delante y registra la venta.</p>
      </div>

      <div className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
        <div>
          <p className="text-heading m-0 font-medium">{clientName}</p>
          <p className="m-0 text-sm">{formatDocumentLine(docType, document, role)}</p>
        </div>
        {blockedFromSim ? (
          <Badge tone="danger">⛔ Bloqueado</Badge>
        ) : (
          <Badge>Cliente</Badge>
        )}
      </div>

      {registerBanner ? <SaleBanner copy={registerBanner} bannerRef={bannerRef} /> : null}

      {banners
        .filter((item) => !(registerBanner && item.title === registerBanner.title))
        .map((copy) => (
          <SaleBanner key={copy.title + copy.body} copy={copy} />
        ))}

      {simulate.isError && (simulateStatus === 0 || simulateStatus >= 500) ? (
        <Alert
          tone="danger"
          icon="✕"
          title="No se pudo calcular."
          action={
            <Button variant="outline" onClick={() => void simulate.refetch()}>
              Reintentar
            </Button>
          }
        >
          Revisa tu conexión e inténtalo de nuevo.
        </Alert>
      ) : null}

      {create.isError && createStatus === 403 ? (
        <Alert>No tienes permiso para registrar ventas.</Alert>
      ) : null}

      {registerFailed ? (
        <Alert
          tone="danger"
          icon="✕"
          title="No se pudo registrar la venta."
          action={
            <div className="flex items-center gap-2">
              {canRetryNetwork ? (
                <Button variant="outline" onClick={retryLastSubmitted}>
                  Reintentar
                </Button>
              ) : null}
              <Link
                to={`/clientes/${clientId}`}
                className={`${buttonVariants({ variant: 'link' })} min-h-11`}
              >
                Ver compras del cliente
              </Link>
            </div>
          }
        >
          Revisa tu conexión. Antes de reintentar, mira las compras del cliente por si ya quedó
          registrada.
        </Alert>
      ) : null}

      {idempotencyReused && !confirmOpen ? (
        <div ref={bannerRef} tabIndex={-1}>
          <IdempotencyReusedNotice
            onViewPurchases={() => {
              setIdempotencyReused(false)
              navigate(`/clientes/${clientId}`)
            }}
            onClose={() => setIdempotencyReused(false)}
          />
        </div>
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <Field
          id="article"
          label="Artículo"
          error={mergedFields.item_description ? formatFieldMessage(mergedFields.item_description) : undefined}
          hint="Lo que se lleva el cliente. Sale así en el contrato."
        >
          <TextInput
            id="article"
            placeholder="Ej.: Nevera Mabe 14 pies"
            value={article}
            maxLength={500}
            error={mergedFields.item_description}
            onChange={(event) => setArticle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault()
            }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="price"
            label="Precio"
            error={
              priceInvalid
                ? MONEY_INVALID_MESSAGE
                : mergedFields.price
                  ? formatFieldMessage(mergedFields.price)
                  : undefined
            }
          >
            <MoneyInput
              id="price"
              value={price}
              onValue={setPrice}
              onInvalid={setPriceInvalid}
              error={priceInvalid ? MONEY_INVALID_MESSAGE : mergedFields.price}
            />
          </Field>
          <Field
            id="down_payment"
            label="Inicial"
            error={
              downInvalid
                ? MONEY_INVALID_MESSAGE
                : mergedFields.down_payment
                  ? formatFieldMessage(mergedFields.down_payment)
                  : undefined
            }
            hint={minDown ? `Mínimo ${minDown.replace(/\.?0+$/, '')} % del precio.` : undefined}
          >
            <MoneyInput
              id="down_payment"
              value={down}
              onValue={setDown}
              onInvalid={setDownInvalid}
              error={downInvalid ? MONEY_INVALID_MESSAGE : mergedFields.down_payment}
            />
          </Field>
        </div>

        <Field
          id="installments"
          label="Plazo (número de cuotas)"
          error={mergedFields.installments ? formatFieldMessage(mergedFields.installments) : undefined}
          hint={`Máximo ${maxInstallments} cuotas.`}
        >
          <Stepper
            id="installments"
            value={installments}
            max={maxInstallments}
            onChange={setInstallments}
            error={mergedFields.installments}
          />
        </Field>

        <Field id="frequency" label="Frecuencia">
          <SegmentedControl
            label="Frecuencia"
            value={frequency}
            options={allowed.map((item) => ({ value: item, label: FREQUENCY_LABEL[item] }))}
            onChange={changeFrequency}
          />
        </Field>

        <FirstDuePicker
          frequency={frequency}
          value={pickerDue}
          onChange={setFirstDue}
          error={
            mergedFields.first_due_date
              ? formatFieldMessage(mergedFields.first_due_date)
              : undefined
          }
        />
      </form>

      {simulate.isError && simulateStatus === 409 && !plan ? null : (
        <PlanCard
          state={planState}
          plan={plan}
          surchargeKind={surchargeKind}
          surchargePercent={surchargePercent}
          dim={planState === 'calculating' && Boolean(plan)}
        />
      )}

      <StickyActionBar
        summary={
          ready && plan
            ? `${planCuotaCount(plan)} × ${formatMoney(plan.installment_amount)}`
            : simulating
              ? 'Calculando…'
              : '—'
        }
        total={ready && plan ? formatMoney(plan.total) : simulating ? '…' : '—'}
        hint={confirmDisabled ? confirmHint : undefined}
      >
        <Button
          className="min-h-12 w-full"
          disabled={confirmDisabled}
          onClick={openConfirm}
        >
          Confirmar venta
        </Button>
      </StickyActionBar>

      {confirmOpen && plan ? (
        <BottomSheet
          title="Revisa antes de registrar"
          titleId="confirm-sale-title"
          onClose={closeConfirm}
          closeDisabled={create.isPending}
        >
          <div>
            <ConfirmRow label="Cliente" value={clientName} />
            <ConfirmRow label="Artículo" value={article.trim()} />
            <ConfirmRow label="Precio" value={formatMoney(plan ? snapshot.price : price)} />
            <ConfirmRow label="Inicial" value={formatMoney(snapshot.down_payment)} />
            <ConfirmRow
              label={surchargeLabel({
                surcharge_kind: surchargeKind,
                surcharge_percent: surchargePercent,
              })}
              value={formatMoney(plan.surcharge)}
            />
            <ConfirmRow label="Total a pagar" value={formatMoney(plan.total)} strong />
            <ConfirmRow
              label="Cuotas"
              value={`${planCuotaCount(plan)} ${frequencyAdjective(frequency, planCuotaCount(plan))} de ${formatMoney(plan.installment_amount)}`}
            />
            <ConfirmRow
              label="Fechas"
              value={`${formatDueDate(planFirstDue(plan))} → ${formatDueDate(planLastDue(plan))}`}
              last
            />
          </div>
          <CuotaDots count={planCuotaCount(plan)} />
          {idempotencyReused ? (
            <IdempotencyReusedNotice
              onViewPurchases={() => {
                closeConfirm()
                navigate(`/clientes/${clientId}`)
              }}
              onClose={closeConfirm}
            />
          ) : (
            <>
              <Button
                className="min-h-12 w-full"
                disabled={create.isPending}
                onClick={submitSale}
              >
                {create.isPending ? 'Registrando…' : 'Registrar venta'}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={create.isPending}
                onClick={closeConfirm}
              >
                Volver a editar
              </Button>
            </>
          )}
        </BottomSheet>
      ) : null}
    </div>
  )
}

function IdempotencyReusedNotice({
  onViewPurchases,
  onClose,
}: {
  onViewPurchases: () => void
  onClose: () => void
}) {
  return (
    <>
      <Alert tone="warning" icon="⚠" title={IDEMPOTENCY_REUSED_TITLE}>
        {IDEMPOTENCY_REUSED_BODY}
      </Alert>
      <Button className="min-h-11 w-full" onClick={onViewPurchases}>
        Ver compras del cliente
      </Button>
      <Button variant="ghost" className="min-h-11 w-full" onClick={onClose}>
        Cerrar
      </Button>
    </>
  )
}

function ConfirmRow({
  label,
  value,
  strong,
  last,
}: {
  label: string
  value: string
  strong?: boolean
  last?: boolean
}) {
  return (
    <div
      className={`flex justify-between py-1.5 text-[15px] ${last ? '' : 'border-border border-b border-dashed'}`}
    >
      <span>{label}</span>
      <b className={`text-heading tabular-nums ${strong ? 'font-bold' : 'font-medium'}`}>{value}</b>
    </div>
  )
}
