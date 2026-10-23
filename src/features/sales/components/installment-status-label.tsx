import {
  installmentStatusLabel,
  installmentStatusTone,
} from '@/features/sales/lib/installment-status'
import type { InstallmentRead } from '@/features/sales/services/types'
import { cn } from '@/features/shared/lib/cn'

/** Isolated status cell: icon + word. Never color alone. */
export function InstallmentStatusLabel({
  status,
  hasPayment,
}: {
  status: string | InstallmentRead['status']
  hasPayment?: boolean
}) {
  const copy = installmentStatusLabel(status, hasPayment)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap',
        installmentStatusTone(status),
      )}
      aria-label={copy.word}
    >
      <span aria-hidden>{copy.icon}</span>
      {copy.word}
    </span>
  )
}
