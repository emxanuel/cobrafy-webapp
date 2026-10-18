export const FREQUENCIES = ['semanal', 'quincenal', 'mensual'] as const
export type Frequency = (typeof FREQUENCIES)[number]

export const SURCHARGE_KINDS = ['percent_of_financed', 'fixed_amount'] as const
export type SurchargeKind = (typeof SURCHARGE_KINDS)[number]

export type SaleWarning = {
  code: string
  message: string
}

export type InstallmentPreview = {
  number: number
  due_date: string
  amount: string
}

export type InstallmentRead = {
  number: number
  due_date: string
  amount: string
  paid: string
  late_fee: string
  status: string
}

export type CreditSettings = {
  interest_method: string
  surcharge_kind: SurchargeKind
  surcharge_percent: string | null
  surcharge_amount: string | null
  allowed_frequencies: Frequency[]
  max_installments: number
  min_down_payment_percent: string | null
}

export type SimulateSaleRequest = {
  client_id?: string | null
  price: string
  down_payment: string
  installments: number
  frequency: Frequency
  first_due_date?: string
}

/** POST /sales/simulate — exact SimulateResponse. */
export type SimulateSaleResponse = {
  financed: string
  surcharge: string
  total: string
  installment_amount: string
  installments: InstallmentPreview[]
  settings_configured: boolean
  anchor_date: string
  anchor_offset: number
  warnings: SaleWarning[]
}

export type SaleCreateRequest = {
  client_id: string
  item_description: string
  price: string
  down_payment: string
  installments: number
  frequency: Frequency
  first_due_date?: string
  anchor_date?: string
  anchor_offset?: number
}

export type SaleClientRef = {
  id: string
  name: string
}

export type SaleVoidedBy = {
  membership_id: string
  name: string
}

/** GET /sales item — exact SaleRead. */
export type SaleRead = {
  id: string
  sale_number: number
  client_id: string
  client: SaleClientRef
  seller_membership_id: string
  item_description: string
  price: string
  down_payment: string
  financed: string
  surcharge: string
  total: string
  surcharge_kind: SurchargeKind
  surcharge_percent: string | null
  surcharge_amount: string | null
  interest_method: string
  frequency: Frequency
  installments_count: number
  anchor_date: string
  anchor_offset: number
  first_due_date: string
  status: string
  voided_at: string | null
  void_reason: string | null
  voided_by: SaleVoidedBy | null
  created_at: string
}

/** POST /sales, GET /sales/{id} — exact SaleDetail. */
export type SaleDetail = SaleRead & {
  installments: InstallmentRead[]
  contract: Record<string, unknown>
  warnings: SaleWarning[]
}

export type SalePage = {
  items: SaleRead[]
  total: number
  page: number
  page_size: number
}
