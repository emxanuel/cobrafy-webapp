import { Badge } from '@/features/shared/components/ui/badge'
import { isSaleVoided } from '@/features/sales/lib/sale-status'

export function SaleStatusBadge({ status }: { status: string }) {
  if (isSaleVoided(status)) {
    return <Badge tone="muted">⊘ Anulada</Badge>
  }
  return <Badge tone="success">● Activa</Badge>
}
