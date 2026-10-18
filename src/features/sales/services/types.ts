export const FREQUENCIES = ['semanal', 'quincenal', 'mensual'] as const
export type Frequency = (typeof FREQUENCIES)[number]

export const SURCHARGE_MODES = ['percent', 'fixed'] as const
export type SurchargeMode = (typeof SURCHARGE_MODES)[number]

export type SaleWarning = {
  code: string
  message: string
}

export type PlanInstallment = {
  number: number
  due_date: string
  amount: string
}

export type CreditSettings = {
  interest_method: string
  surcharge_mode: SurchargeMode
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

export type SimulateSaleResponse = {
  settings_configured: boolean
  financed_balance: string
  surcharge: string
  surcharge_percent: string | null
  surcharge_mode: SurchargeMode
  total: string
  installment_amount: string
  installment_count: number
  frequency: Frequency
  first_due_date: string
  last_due_date: string
  anchor_date: string
  anchor_offset: number
  installments: PlanInstallment[]
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

export type SaleClient = {
  id: string
  name: string
}

export type SaleRead = {
  id: string
  sale_number: number
  client: SaleClient
  item_description: string
  price: string
  down_payment: string
  financed_balance: string
  surcharge: string
  surcharge_percent: string | null
  surcharge_mode: SurchargeMode
  total: string
  installment_amount: string
  installment_count: number
  frequency: Frequency
  first_due_date: string
  last_due_date: string
  status: string
  voided_at: string | null
  voided_reason: string | null
  voided_by: string | null
  installments: PlanInstallment[]
  warnings: SaleWarning[]
}

export type SalePage = {
  items: SaleRead[]
  total: number
  page: number
  page_size: number
}
