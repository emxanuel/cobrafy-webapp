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

export const LATE_FEE_KINDS = ['percent', 'fixed'] as const
export type LateFeeKind = (typeof LATE_FEE_KINDS)[number] | null

/** API names. Never use late_fee_percent_bp / late_fee_fixed_cents / late_fee_cap_cents. */
export const LATE_FEE_FIELDS = [
  'late_fee_kind',
  'late_fee_percent',
  'late_fee_fixed',
  'late_fee_grace_days',
  'late_fee_cap',
] as const

export type LateFeeField = (typeof LATE_FEE_FIELDS)[number]

export type CreditSettingsLateFees = {
  late_fee_kind: LateFeeKind
  late_fee_percent: string | null
  late_fee_fixed: string | null
  late_fee_grace_days: number
  late_fee_cap: string | null
}

export type CreditSettings = {
  interest_method: string
  surcharge_kind: SurchargeKind
  surcharge_percent: string | null
  surcharge_amount: string | null
  allowed_frequencies: Frequency[]
  max_installments: number
  min_down_payment_percent: string | null
  /** Sent by backend PR #22. If absent (old backend), do not show the Design banner. */
  configured?: boolean
} & Partial<CreditSettingsLateFees>

/** PUT body. Extra keys (including GET `configured`) → 422. */
export type CreditSettingsWrite = {
  interest_method: string
  surcharge_kind: SurchargeKind
  surcharge_percent: string | null
  surcharge_amount: string | null
  allowed_frequencies: Frequency[]
  max_installments: number
  min_down_payment_percent: string | null
} & Partial<CreditSettingsLateFees>

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

/** GET /sales and GET /clients/{id}/sales item — exact SaleRead. `balance` is required. */
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
  balance: string | null
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

export type SaleContractSeller = {
  membership_id: string
  name: string
}

export type SaleContract = {
  business?: {
    name?: string
    rnc?: string | null
    address?: string | null
    phone?: string | null
  }
  client?: {
    name?: string
    doc_type?: string
    phone?: string
    address?: string
  }
  guarantors?: Array<Record<string, unknown>>
  item?: { description?: string }
  seller?: SaleContractSeller
}

/** POST /sales, GET /sales/{id} — exact SaleDetail. */
export type SaleDetail = SaleRead & {
  installments: InstallmentRead[]
  contract: SaleContract
  warnings: SaleWarning[]
}

export type SalePage = {
  items: SaleRead[]
  total: number
  page: number
  page_size: number
}
