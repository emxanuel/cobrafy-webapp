export const saleKeys = {
  all: ['sales'] as const,
  list: (businessId: string | null, status: string) =>
    [...saleKeys.all, businessId, { status }] as const,
  detail: (businessId: string | null, saleId: string) =>
    [...saleKeys.all, businessId, saleId] as const,
  simulate: (
    businessId: string | null,
    clientId: string,
    inputs: {
      price: string
      down_payment: string
      installments: number
      frequency: string
      first_due_date: string
    },
  ) => [...saleKeys.all, 'simulate', businessId, clientId, inputs] as const,
}

export const creditSettingsKeys = {
  all: ['credit-settings'] as const,
  detail: (businessId: string | null) => [...creditSettingsKeys.all, businessId] as const,
}

export const businessKeys = {
  all: ['business'] as const,
  detail: (businessId: string | null) => [...businessKeys.all, businessId] as const,
}
