import type { SaleDetail, SimulateSaleResponse } from '@/features/sales/services/types'

export function planCuotaCount(plan: SimulateSaleResponse): number {
  return plan.installments.length
}

export function planFirstDue(plan: SimulateSaleResponse): string {
  return plan.installments[0]?.due_date ?? ''
}

export function planLastDue(plan: SimulateSaleResponse): string {
  return plan.installments.at(-1)?.due_date ?? ''
}

export function saleCuotaAmount(sale: SaleDetail): string {
  return sale.installments[0]?.amount ?? '0.00'
}
