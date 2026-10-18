import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { InstallmentTable } from '@/features/sales/components/installment-table'
import { SaleStatusBadge } from '@/features/sales/components/sale-status-badge'
import { VoidBanner } from '@/features/sales/components/void-banner'
import { VoidSaleSheet } from '@/features/sales/components/void-sale-sheet'
import { isVoidReasonValid } from '@/features/sales/lib/void-reason'
import {
  invalidateSaleViews,
  refreshSessionRole,
  useDownloadContractMutation,
  useSale,
  useVoidSaleMutation,
} from '@/features/sales/hooks/use-sales-queries'
import {
  CONTRACT_DOWNLOAD_ERROR_BODY,
  CONTRACT_DOWNLOAD_ERROR_TITLE,
  CONTRACT_FORBIDDEN_MESSAGE,
  SALE_NOT_FOUND_TITLE,
  VOID_FORBIDDEN_MESSAGE,
  formatFieldMessage,
  frequencyAdjective,
  saleErrorBanner,
  surchargeLabel,
  voidSuccessMessage,
} from '@/features/sales/lib/copy'
import { triggerBlobDownload } from '@/features/sales/lib/download'
import { saleCuotaAmount } from '@/features/sales/lib/plan-view'
import { canShowVoid, isSaleVoided } from '@/features/sales/lib/sale-status'
import type { SaleDetail } from '@/features/sales/services/types'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button, buttonVariants } from '@/features/shared/components/ui/button'
import { Skeleton } from '@/features/shared/components/ui/skeleton'
import { getFieldErrors, isApiError } from '@/features/shared/lib/api-error'
import { cn } from '@/features/shared/lib/cn'
import { formatDateTime } from '@/features/shared/lib/format-date'
import { formatMoney } from '@/features/shared/lib/format-money'
import { canDownloadContract } from '@/features/shared/lib/roles'

export function SaleDetailPage() {
  const { saleId = '' } = useParams()
  const location = useLocation()
  const fromClient = (location.state as { fromClient?: string } | null)?.fromClient
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const queryClient = useQueryClient()
  const saleQuery = useSale(saleId)
  const [notice, setNotice] = useState<{
    tone: 'success' | 'danger' | 'muted' | 'warning'
    title: string
    body?: string
  } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [voidForbidden, setVoidForbidden] = useState(false)
  const [voidBusy, setVoidBusy] = useState(false)
  const businessId = activeBusinessId
  const sale = saleQuery.data
  const voidMutation = useVoidSaleMutation(saleId, sale?.client_id ?? '')
  const download = useDownloadContractMutation()

  const backTo = fromClient ? `/clientes/${fromClient}` : '/ventas'
  const backLabel = fromClient ? '‹ Volver a la ficha' : '‹ Ventas'

  if (saleQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <span className="sr-only">Cargando…</span>
        <Skeleton className="h-7 w-3/5" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (saleQuery.isError && !sale) {
    const status = isApiError(saleQuery.error) ? saleQuery.error.status : 0
    if (status === 404) {
      return (
        <Alert tone="muted" icon="ⓘ" title={SALE_NOT_FOUND_TITLE} action={
          <Link to="/ventas" className={`${buttonVariants({ variant: 'outline' })} no-underline`}>
            Volver a ventas
          </Link>
        } />
      )
    }
    return (
      <Alert
        icon="✕"
        title="No se pudo cargar la venta."
        action={
          <Button variant="outline" onClick={() => void saleQuery.refetch()}>
            Reintentar
          </Button>
        }
      >
        Revisa tu conexión e inténtalo de nuevo.
      </Alert>
    )
  }

  if (!sale) return null

  const voided = isSaleVoided(sale.status)
  const showVoid = canShowVoid(role, sale) && !voidForbidden
  const downloadCode = isApiError(download.error) ? download.error.code : undefined
  const downloadForbidden = isApiError(download.error) && download.error.status === 403
  const legacyMissing = downloadCode === 'LEGACY_SALE_LEGAL_DATA_MISSING'
  const sellerName = sale.contract.seller?.name ?? ''

  function closeSheet() {
    setSheetOpen(false)
    setNetworkError(false)
    setUnconfirmed(false)
    setFieldError(null)
  }

  function markSuccess(current: SaleDetail) {
    closeSheet()
    setNotice({ tone: 'success', title: voidSuccessMessage(current.sale_number) })
  }

  async function afterTimeout() {
    const result = await saleQuery.refetch()
    const next = result.data
    if (next && isSaleVoided(next.status)) {
      markSuccess(next)
      return
    }
    setUnconfirmed(true)
  }

  async function submitVoid() {
    if (!isVoidReasonValid(reason) || !sale || voidBusy) return
    setFieldError(null)
    setNetworkError(false)
    setUnconfirmed(false)
    setVoidBusy(true)
    try {
      const updated = await voidMutation.mutateAsync(reason.trim())
      markSuccess(updated)
    } catch (error) {
      if (isApiError(error) && error.status === 0) {
        voidMutation.reset()
        await afterTimeout()
        return
      }
      if (isApiError(error) && error.code === 'SALE_ALREADY_VOIDED') {
        closeSheet()
        await saleQuery.refetch()
        const copy = saleErrorBanner(error.code, role, sale.client_id, error.message)
        setNotice({ tone: copy.tone, title: copy.title, body: copy.body || undefined })
        return
      }
      if (isApiError(error) && error.code === 'SALE_HAS_PAYMENTS') {
        closeSheet()
        invalidateSaleViews(queryClient, businessId, sale.id, sale.client_id)
        const copy = saleErrorBanner(error.code, role, sale.client_id, error.message)
        setNotice({ tone: 'danger', title: copy.title, body: copy.body || undefined })
        return
      }
      if (isApiError(error) && error.status === 403) {
        closeSheet()
        setVoidForbidden(true)
        try {
          await refreshSessionRole()
        } catch {
          /* keep the local hide */
        }
        setNotice({ tone: 'danger', title: VOID_FORBIDDEN_MESSAGE })
        return
      }
      if (isApiError(error) && error.status === 404) {
        closeSheet()
        setNotice({ tone: 'muted', title: SALE_NOT_FOUND_TITLE })
        return
      }
      if (isApiError(error) && error.status === 422) {
        const reasonMsg = getFieldErrors(error).reason
        setFieldError(reasonMsg ? formatFieldMessage(reasonMsg) : formatFieldMessage(error.message))
        return
      }
      setNetworkError(true)
    } finally {
      setVoidBusy(false)
    }
  }

  function startDownload() {
    if (!sale) return
    download.mutate(sale.id, {
      onSuccess: ({ blob, filename }) => triggerBlobDownload(blob, filename),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to={backTo} className={`${buttonVariants({ variant: 'link' })} min-h-11 no-underline`}>
          {backLabel}
        </Link>
        <div className="flex items-start justify-between gap-2">
          <h1 className="m-0 text-3xl tracking-tight">Venta #{sale.sale_number}</h1>
          <SaleStatusBadge status={sale.status} />
        </div>
        <p className="mt-1">{sale.item_description}</p>
      </div>

      {notice ? (
        <Alert
          tone={notice.tone}
          icon={notice.tone === 'success' ? '✓' : notice.tone === 'muted' ? 'ⓘ' : '✕'}
          title={notice.title}
        >
          {notice.body}
        </Alert>
      ) : null}

      <div className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-heading m-0 font-medium">{sale.client.name}</p>
          <p className="m-0 text-sm">
            Vendió: {sellerName}
            {sellerName ? ' · ' : ''}
            {formatDateTime(sale.created_at)}
          </p>
        </div>
        <Link
          to={`/clientes/${sale.client_id}`}
          className={`${buttonVariants({ variant: 'link' })} min-h-11 shrink-0 no-underline`}
        >
          Ver ficha
        </Link>
      </div>

      {voided ? <VoidBanner sale={sale} role={role} /> : null}

      {canDownloadContract(role) ? (
        <div className="flex flex-col gap-2">
          {legacyMissing ? (
            <Alert
              tone="warning"
              icon="⚠"
              title="Esta venta se registró sin RNC ni dirección del negocio."
            >
              Por eso no se puede generar su contrato.
            </Alert>
          ) : null}
          {download.isError && !legacyMissing ? (
            <Alert
              tone="danger"
              icon="✕"
              title={downloadForbidden ? CONTRACT_FORBIDDEN_MESSAGE : CONTRACT_DOWNLOAD_ERROR_TITLE}
              action={
                downloadForbidden ? undefined : (
                  <Button variant="outline" onClick={startDownload}>
                    Reintentar
                  </Button>
                )
              }
            >
              {downloadForbidden ? null : CONTRACT_DOWNLOAD_ERROR_BODY}
            </Alert>
          ) : null}
          {!legacyMissing ? (
            <Button
              variant={voided ? 'outline' : 'primary'}
              className="min-h-12 w-full"
              disabled={download.isPending}
              onClick={startDownload}
            >
              {download.isPending
                ? 'Preparando contrato…'
                : voided
                  ? '⬇ Descargar contrato (marcado ANULADA)'
                  : '⬇ Descargar contrato'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <SaleFigures sale={sale} dim={voided} />

      <InstallmentTable sale={sale} />

      {showVoid ? (
        <section className="flex flex-col gap-2">
          <div className="bg-border h-px" />
          <Button
            variant="danger"
            className="min-h-12 w-full"
            onClick={() => {
              setSheetOpen(true)
              setNetworkError(false)
              setUnconfirmed(false)
              setFieldError(null)
            }}
          >
            Anular venta
          </Button>
          <p className="m-0 text-center text-sm">
            Solo si la registraste por error. No se puede deshacer.
          </p>
        </section>
      ) : null}

      {sheetOpen ? (
        <VoidSaleSheet
          saleNumber={sale.sale_number}
          installmentsCount={sale.installments_count}
          reason={reason}
          onReason={setReason}
          pending={voidBusy}
          submitting={voidBusy}
          networkError={networkError}
          unconfirmed={unconfirmed}
          fieldError={fieldError}
          onSubmit={() => {
            void submitVoid()
          }}
          onClose={closeSheet}
        />
      ) : null}
    </div>
  )
}

function SaleFigures({ sale, dim }: { sale: SaleDetail; dim: boolean }) {
  const voided = isSaleVoided(sale.status)
  const balance = sale.balance == null ? '—' : formatMoney(sale.balance)
  return (
    <section
      className={cn(
        'border-border flex flex-col gap-2 rounded-md border px-4 py-4',
        dim && 'opacity-45',
      )}
    >
      <p className="m-0 text-sm">
        {sale.installments_count} cuotas {frequencyAdjective(sale.frequency, sale.installments_count)} de
      </p>
      <p className="text-heading m-0 text-[30px] leading-tight font-semibold tabular-nums">
        {formatMoney(saleCuotaAmount(sale))}
      </p>
      <div>
        <FigureRow label="Precio" value={formatMoney(sale.price)} />
        <FigureRow label="Inicial" value={formatMoney(sale.down_payment)} />
        <FigureRow label="Saldo financiado" value={formatMoney(sale.financed)} />
        <FigureRow
          label={surchargeLabel({
            surcharge_kind: sale.surcharge_kind,
            surcharge_percent: sale.surcharge_percent,
          })}
          value={formatMoney(sale.surcharge)}
        />
        <FigureRow label="Total a pagar" value={formatMoney(sale.total)} strong />
        <FigureRow
          label="Saldo pendiente"
          value={voided ? `${balance} · anulada` : balance}
          strong={!voided}
          muted={voided}
        />
        <FigureRow label="Método" value="Recargo fijo" last />
      </div>
    </section>
  )
}

function FigureRow({
  label,
  value,
  strong = false,
  last = false,
  muted = false,
}: {
  label: string
  value: string
  strong?: boolean
  last?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        'flex justify-between py-1.5 text-[15px]',
        !last && 'border-border border-b border-dashed',
      )}
    >
      <span>{label}</span>
      <b
        className={cn(
          'tabular-nums',
          muted ? 'font-medium' : 'text-heading',
          strong && !muted ? 'font-bold' : 'font-medium',
        )}
      >
        {value}
      </b>
    </div>
  )
}
