import { installmentStatusKind } from '@/features/sales/lib/installment-status'
import { isSaleVoided } from '@/features/sales/lib/sale-status'

export type DotStatus =
  | 'pending'
  | 'paid'
  | 'late'
  | 'partial'
  | 'cancelled'
  | 'late-partial'
  | 'pending-paid'

function toDotStatus(status: string, hasPayment?: boolean): DotStatus {
  const kind = installmentStatusKind(status)
  if (kind === 'paid') return 'paid'
  if (kind === 'overdue') return hasPayment ? 'late-partial' : 'late'
  if (kind === 'partial') return 'partial'
  if (kind === 'cancelled') return 'cancelled'
  return hasPayment ? 'pending-paid' : 'pending'
}

export function saleDotStatuses(sale: {
  status: string
  installments_count: number
  installments?: Array<{ status: string; has_payment?: boolean }>
}): DotStatus[] {
  if (isSaleVoided(sale.status)) {
    return Array.from({ length: sale.installments_count }, () => 'cancelled')
  }
  if (sale.installments?.length) {
    const fromRows = sale.installments.map((row) => toDotStatus(row.status, row.has_payment))
    if (fromRows.length >= sale.installments_count) return fromRows
    return Array.from(
      { length: sale.installments_count },
      (_, index) => fromRows[index] ?? 'pending',
    )
  }
  return Array.from({ length: sale.installments_count }, () => 'pending')
}
