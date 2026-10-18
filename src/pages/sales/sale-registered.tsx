import { Link } from 'react-router'

import type { Role } from '@/features/auth/services/types'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button, buttonVariants } from '@/features/shared/components/ui/button'
import { formatDueDate } from '@/features/shared/lib/format-due-date'
import { formatMoney } from '@/features/shared/lib/format-money'
import { isApiError } from '@/features/shared/lib/api-error'
import { CuotaDots } from '@/features/sales/components/cuota-dots'
import { SaleBanner } from '@/features/sales/components/sale-banner'
import { frequencyAdjective, registeredCollectorWarning, saleErrorBanner } from '@/features/sales/lib/copy'
import { saleCuotaAmount } from '@/features/sales/lib/plan-view'
import { useDownloadContractMutation } from '@/features/sales/hooks/use-sales-queries'
import type { SaleDetail } from '@/features/sales/services/types'

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SaleRegistered({
  sale,
  role,
}: {
  sale: SaleDetail
  role: Role | null
}) {
  const download = useDownloadContractMutation()
  const clientId = sale.client.id
  const collectorInactive = sale.warnings.some((item) => item.code === 'collector_inactive')
  const downloadError = download.error
  const downloadCode = isApiError(downloadError) ? downloadError.code : undefined

  function startDownload() {
    download.mutate(sale.id, {
      onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col items-center pt-2 text-center" role="status">
        <span className="text-success text-[44px] leading-none" aria-hidden>
          ✓
        </span>
        <h1 className="m-0 text-3xl tracking-tight">Listo, venta #{sale.sale_number} registrada.</h1>
        <p className="mt-1">
          {sale.client.name} · {sale.item_description}
        </p>
      </section>

      <section className="border-border rounded-md border px-4 py-4">
        <p className="m-0 text-sm">
          {sale.installments_count} cuotas {frequencyAdjective(sale.frequency, sale.installments_count)} de
        </p>
        <p className="text-heading m-0 text-[30px] leading-tight font-semibold tabular-nums">
          {formatMoney(saleCuotaAmount(sale))}
        </p>
        <div className="mt-2">
          <CuotaDots count={sale.installments_count} />
        </div>
        <div className="border-border mt-2 flex justify-between border-b border-dashed py-1.5">
          <span>Primera cuota</span>
          <b className="text-heading font-medium tabular-nums">{formatDueDate(sale.first_due_date)}</b>
        </div>
        <div className="flex justify-between py-1.5">
          <span>Total a pagar</span>
          <b className="text-heading font-bold tabular-nums">{formatMoney(sale.total)}</b>
        </div>
      </section>

      {collectorInactive ? (
        <SaleBanner copy={registeredCollectorWarning(role, clientId)} />
      ) : null}

      {downloadCode === 'LEGACY_SALE_LEGAL_DATA_MISSING' ? (
        <SaleBanner copy={saleErrorBanner(downloadCode, role, clientId)} />
      ) : null}

      {download.isError && downloadCode !== 'LEGACY_SALE_LEGAL_DATA_MISSING' ? (
        <Alert
          tone="danger"
          icon="✕"
          title="No se pudo descargar el contrato."
          action={
            <Button variant="outline" onClick={startDownload}>
              Reintentar
            </Button>
          }
        >
          Inténtalo de nuevo. La venta ya quedó registrada.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button className="min-h-12 w-full" disabled={download.isPending} onClick={startDownload}>
          {download.isPending ? 'Preparando contrato…' : '⬇ Descargar contrato'}
        </Button>
        <Link
          to={`/clientes/${clientId}`}
          className={`${buttonVariants({ variant: 'outline' })} min-h-12 w-full no-underline`}
        >
          Ver venta
        </Link>
        <Link
          to={`/clientes/${clientId}`}
          className={`${buttonVariants({ variant: 'ghost' })} min-h-12 w-full no-underline`}
        >
          Volver al cliente
        </Link>
      </div>
    </div>
  )
}

