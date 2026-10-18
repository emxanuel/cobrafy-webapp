import {
  installmentStatusKind,
  type InstallmentStatusKind,
} from '@/features/sales/lib/installment-status'
import type { InstallmentRead } from '@/features/sales/services/types'

const LABEL: Record<InstallmentStatusKind, { icon: string; word: string }> = {
  pending: { icon: '○', word: 'Pendiente' },
  paid: { icon: '●', word: 'Pagada' },
  partial: { icon: '◐', word: 'Parcial' },
  overdue: { icon: '⚠', word: 'Vencida' },
  cancelled: { icon: '⊘', word: 'Cancelada' },
}

/** Isolated status cell: icon + word. Swap the look here (pending Emmanuel OK). */
export function InstallmentStatusLabel({
  status,
}: {
  status: string | InstallmentRead['status']
}) {
  const kind = installmentStatusKind(status)
  const copy = LABEL[kind]
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden>{copy.icon}</span>
      {copy.word}
    </span>
  )
}
