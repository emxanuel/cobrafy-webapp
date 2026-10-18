import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useSwitchingFromToken } from '@/features/auth/lib/switching-token'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { clientKeys } from '@/features/clients/query-keys'
import { creditSettingsKeys, saleKeys } from '@/features/sales/query-keys'
import {
  createSale,
  downloadSaleContract,
  getCreditSettings,
  listClientSales,
  simulateSale,
} from '@/features/sales/services/requests'
import type { SaleCreateRequest, SimulateSaleRequest } from '@/features/sales/services/types'

export function useCreditSettings() {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useQuery({
    queryKey: creditSettingsKeys.detail(businessId),
    queryFn: () => getCreditSettings(businessId!),
    enabled: Boolean(businessId),
  })
}

export function useSimulateSale(clientId: string, payload: SimulateSaleRequest | null) {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  const inputs = payload
    ? {
        price: payload.price,
        down_payment: payload.down_payment,
        installments: payload.installments,
        frequency: payload.frequency,
        first_due_date: payload.first_due_date ?? '',
      }
    : null
  return useQuery({
    queryKey: saleKeys.simulate(businessId, clientId, inputs ?? { price: '', down_payment: '', installments: 0, frequency: '', first_due_date: '' }),
    queryFn: () => simulateSale(payload!),
    enabled: Boolean(businessId && clientId && payload),
    placeholderData: keepPreviousData,
  })
}

export function useClientSales(clientId: string | undefined) {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  const switchingFrom = useSwitchingFromToken()
  return useQuery({
    queryKey: clientKeys.sales(clientId ?? ''),
    queryFn: () => listClientSales(clientId!),
    enabled: Boolean(clientId) && Boolean(businessId) && !switchingFrom,
  })
}

export function useCreateSaleMutation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: SaleCreateRequest
      idempotencyKey: string
    }) => createSale(payload, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
      void queryClient.invalidateQueries({ queryKey: clientKeys.history(null, clientId) })
      void queryClient.invalidateQueries({ queryKey: clientKeys.sales(clientId) })
    },
  })
}

export function useDownloadContractMutation() {
  return useMutation({
    mutationFn: downloadSaleContract,
  })
}
