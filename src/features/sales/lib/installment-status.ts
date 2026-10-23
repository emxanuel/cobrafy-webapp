export type InstallmentStatusKind = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled'

export const INSTALLMENT_STATUS_COPY: Record<
  InstallmentStatusKind,
  { icon: string; word: string }
> = {
  pending: { icon: '○', word: 'Pendiente' },
  paid: { icon: '●', word: 'Pagada' },
  partial: { icon: '◐', word: 'Parcial' },
  overdue: { icon: '⚠', word: 'Vencida' },
  cancelled: { icon: '⊘', word: 'Cancelada' },
}

export function installmentStatusKind(status: string): InstallmentStatusKind {
  if (status === 'paid' || status === 'pagada') return 'paid'
  if (status === 'partial' || status === 'parcial') return 'partial'
  if (status === 'overdue' || status === 'vencida' || status === 'late') return 'overdue'
  if (status === 'cancelled' || status === 'cancelada') return 'cancelled'
  return 'pending'
}

export function installmentStatusLabel(
  status: string,
  hasPayment?: boolean,
): { icon: string; word: string } {
  const kind = installmentStatusKind(status)
  if (kind === 'overdue' && hasPayment) {
    return { icon: '⚠', word: 'Vencida · abonada' }
  }
  if (kind === 'pending' && hasPayment) {
    return { icon: '○', word: 'Pendiente · abonada' }
  }
  return INSTALLMENT_STATUS_COPY[kind]
}

export function installmentStatusTone(status: string): string {
  const kind = installmentStatusKind(status)
  if (kind === 'paid') return 'text-success'
  if (kind === 'partial') return 'text-warning'
  if (kind === 'overdue') return 'text-danger'
  return 'text-text'
}
