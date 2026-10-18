import type {
  Frequency,
  SaleCreateRequest,
  SimulateSaleResponse,
} from '@/features/sales/services/types'

export type SaleFormSnapshot = {
  client_id: string
  item_description: string
  price: string
  down_payment: string
  installments: number
  frequency: Frequency
  first_due_date: string
}

export function saleFormFingerprint(form: SaleFormSnapshot): string {
  return [
    form.client_id,
    form.item_description,
    form.price,
    form.down_payment,
    String(form.installments),
    form.frequency,
    form.first_due_date,
  ].join('|')
}

export function buildSaleCreateBody(
  form: SaleFormSnapshot,
  simulation: Pick<SimulateSaleResponse, 'anchor_date' | 'anchor_offset'>,
): SaleCreateRequest {
  return {
    client_id: form.client_id,
    item_description: form.item_description,
    price: form.price,
    down_payment: form.down_payment,
    installments: form.installments,
    frequency: form.frequency,
    anchor_date: simulation.anchor_date,
    anchor_offset: simulation.anchor_offset,
  }
}

export function hasXorDueAnchor(body: SaleCreateRequest): boolean {
  const hasFirst = body.first_due_date != null && body.first_due_date !== ''
  const hasAnchor =
    body.anchor_date != null &&
    body.anchor_date !== '' &&
    body.anchor_offset != null
  return hasFirst !== hasAnchor
}
