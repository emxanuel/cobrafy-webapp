import type { DotStatus } from '@/features/sales/lib/dot-status'
import type { InstallmentsSummary } from '@/features/sales/services/types'

export function statusCountLabel(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`
}

export function isSaleSettled(sale: {
  installments_count: number
  installments_summary?: InstallmentsSummary
}): boolean {
  const summary = sale.installments_summary
  return Boolean(summary && sale.installments_count > 0 && summary.paid === sale.installments_count)
}

function ariaPartsFromSummary(summary: InstallmentsSummary): string[] {
  return [
    summary.paid ? statusCountLabel(summary.paid, 'pagada', 'pagadas') : null,
    summary.partial ? statusCountLabel(summary.partial, 'parcial', 'parciales') : null,
    summary.overdue ? statusCountLabel(summary.overdue, 'vencida', 'vencidas') : null,
    summary.pending ? statusCountLabel(summary.pending, 'pendiente', 'pendientes') : null,
  ].filter((part): part is string => Boolean(part))
}

function ariaPartsFromStatuses(count: number, statuses: DotStatus[]): string[] {
  const paid = statuses.filter((item) => item === 'paid').length
  const late = statuses.filter((item) => item === 'late' || item === 'late-partial').length
  const partial = statuses.filter((item) => item === 'partial').length
  const cancelled = statuses.filter((item) => item === 'cancelled').length
  const pending = count - paid - late - partial - cancelled
  return [
    paid ? statusCountLabel(paid, 'pagada', 'pagadas') : null,
    partial ? statusCountLabel(partial, 'parcial', 'parciales') : null,
    late ? statusCountLabel(late, 'vencida', 'vencidas') : null,
    pending ? statusCountLabel(pending, 'pendiente', 'pendientes') : null,
  ].filter((part): part is string => Boolean(part))
}

export function dotsAriaLabel(input: {
  count: number
  summary?: InstallmentsSummary
  statuses?: DotStatus[]
}): string {
  const { count, summary, statuses = [] } = input
  if (summary) {
    if (count > 0 && summary.cancelled === count) {
      return `${count} cuotas canceladas`
    }
    return `${count} cuotas: ${ariaPartsFromSummary(summary).join(', ')}`
  }
  const cancelled = statuses.filter((item) => item === 'cancelled').length
  if (count > 0 && cancelled === count) {
    return `${count} cuotas canceladas`
  }
  return `${count} cuotas: ${ariaPartsFromStatuses(count, statuses).join(', ')}`
}

export type SummaryPart = {
  key: 'paid' | 'partial' | 'overdue' | 'pending'
  icon: string
  label: string
  className?: string
}

export function summaryLineParts(summary: InstallmentsSummary): SummaryPart[] {
  const parts: SummaryPart[] = []
  if (summary.paid) {
    parts.push({
      key: 'paid',
      icon: '●',
      label: statusCountLabel(summary.paid, 'pagada', 'pagadas'),
    })
  }
  if (summary.partial) {
    parts.push({
      key: 'partial',
      icon: '◐',
      label: statusCountLabel(summary.partial, 'parcial', 'parciales'),
    })
  }
  if (summary.overdue) {
    parts.push({
      key: 'overdue',
      icon: '⚠',
      label: statusCountLabel(summary.overdue, 'vencida', 'vencidas'),
      className: 'text-danger font-semibold',
    })
  }
  if (summary.pending) {
    parts.push({
      key: 'pending',
      icon: '○',
      label: statusCountLabel(summary.pending, 'pendiente', 'pendientes'),
    })
  }
  return parts
}
