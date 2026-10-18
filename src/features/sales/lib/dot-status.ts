import type { DotStatus } from '@/features/sales/components/cuota-dots'
import { installmentStatusKind } from '@/features/sales/lib/installment-status'
import { isSaleVoided } from '@/features/sales/lib/sale-status'
import type { InstallmentRead } from '@/features/sales/services/types'

function toDotStatus(status: string): DotStatus {
  const kind = installmentStatusKind(status)
  if (kind === 'paid') return 'paid'
  if (kind === 'overdue') return 'late'
  if (kind === 'partial') return 'partial'
  if (kind === 'cancelled') return 'cancelled'
  return 'pending'
}

export function saleDotStatuses(sale: {
  status: string
  installments_count: number
  installments?: InstallmentRead[]
}): DotStatus[] {
  if (isSaleVoided(sale.status)) {
    return Array.from({ length: sale.installments_count }, () => 'cancelled')
  }
  if (sale.installments?.length) {
    const fromRows = sale.installments.map((row) => toDotStatus(row.status))
    if (fromRows.length >= sale.installments_count) return fromRows
    return Array.from(
      { length: sale.installments_count },
      (_, index) => fromRows[index] ?? 'pending',
    )
  }
  return Array.from({ length: sale.installments_count }, () => 'pending')
}
