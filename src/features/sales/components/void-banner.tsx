import { displayFreeText } from '@/features/clients/lib/display-document'
import { isSaleVoided } from '@/features/sales/lib/sale-status'
import type { SaleRead } from '@/features/sales/services/types'
import type { Role } from '@/features/auth/services/types'
import { formatDateTime } from '@/features/shared/lib/format-date'

export function VoidBanner({ sale, role }: { sale: SaleRead; role: Role | null }) {
  if (!isSaleVoided(sale.status)) return null
  const when = sale.voided_at ? formatDateTime(sale.voided_at) : ''
  const who = sale.voided_by?.name
  return (
    <section
      role="status"
      className="border-border bg-muted flex flex-col gap-1.5 rounded-md border-2 p-3.5"
    >
      <p className="text-heading m-0 text-[17px] font-semibold">⊘ Venta anulada</p>
      {sale.void_reason ? (
        <p className="text-heading m-0">
          <b>Motivo:</b> {displayFreeText(sale.void_reason, role)}
        </p>
      ) : null}
      <p className="m-0 text-sm">
        {who ? `Anulada por ${who}${when ? ` · ${when}` : ''}` : when ? `Anulada el ${when}` : null}
      </p>
      <p className="m-0 text-sm">Ya no cuenta en la cartera ni en el saldo del cliente.</p>
    </section>
  )
}
