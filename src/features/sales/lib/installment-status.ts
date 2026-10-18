export type InstallmentStatusKind = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled'

export function installmentStatusKind(status: string): InstallmentStatusKind {
  if (status === 'paid' || status === 'pagada') return 'paid'
  if (status === 'partial' || status === 'parcial') return 'partial'
  if (status === 'overdue' || status === 'vencida' || status === 'late') return 'overdue'
  if (status === 'cancelled' || status === 'cancelada') return 'cancelled'
  return 'pending'
}
