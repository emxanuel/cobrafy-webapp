import type { Role } from '@/features/auth/services/types'
import { canVoidSale } from '@/features/shared/lib/roles'

export function isSaleVoided(status: string): boolean {
  return status === 'anulada' || status === 'voided'
}

/** True when `paid` is a zero amount string. Never parses to number. */
export function isUnpaidAmount(paid: string): boolean {
  const trimmed = paid.trim()
  if (!trimmed) return false
  const unsigned = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed
  const [whole = '', frac = ''] = unsigned.split('.')
  const digits = `${whole}${frac}`.replace(/\D/g, '')
  if (!digits) return false
  for (const ch of digits) {
    if (ch !== '0') return false
  }
  return true
}

export function canShowVoid(
  role: Role | null,
  sale: { status: string; installments: Array<{ paid: string }> },
): boolean {
  if (!canVoidSale(role)) return false
  if (isSaleVoided(sale.status)) return false
  return sale.installments.every((item) => isUnpaidAmount(item.paid))
}

export function purchaseCounterLabel(items: Array<{ status: string }>): string {
  let active = 0
  let voided = 0
  for (const item of items) {
    if (isSaleVoided(item.status)) voided += 1
    else active += 1
  }
  const activeLabel = active === 1 ? '1 activa' : `${active} activas`
  const voidedLabel = voided === 1 ? '1 anulada' : `${voided} anuladas`
  return `${activeLabel} · ${voidedLabel}`
}
