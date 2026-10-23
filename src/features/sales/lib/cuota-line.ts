import { frequencyAdjective } from '@/features/sales/lib/copy'
import type { Frequency } from '@/features/sales/services/types'
import { formatMoney } from '@/features/shared/lib/format-money'

export function saleCuotaLine(sale: {
  installments_count: number
  frequency: Frequency
  regular_installment_amount?: string
  last_installment_amount?: string
}): string {
  const count = sale.installments_count
  const freq = `${count} ${frequencyAdjective(sale.frequency, count)}`
  const regular = sale.regular_installment_amount
  if (!regular) return freq
  if (count === 1) return formatMoney(regular)
  const base = `${freq} × ${formatMoney(regular)}`
  const last = sale.last_installment_amount
  if (last && last !== regular) return `${base} · última ${formatMoney(last)}`
  return base
}
