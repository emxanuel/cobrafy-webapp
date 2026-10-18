import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { getMe } from '@/features/auth/services/requests'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { useSwitchingFromToken } from '@/features/auth/lib/switching-token'
import { getBusiness, patchBusiness } from '@/features/business/services/requests'
import type { BusinessPatch } from '@/features/business/services/types'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { clientKeys } from '@/features/clients/query-keys'
import { businessKeys, creditSettingsKeys, saleKeys } from '@/features/sales/query-keys'
import {
  createSale,
  downloadSaleContract,
  getCreditSettings,
  getSale,
  listClientSales,
  listSales,
  putCreditSettings,
  simulateSale,
  voidSale,
} from '@/features/sales/services/requests'
import type {
  CreditSettings,
  CreditSettingsWrite,
  SaleCreateRequest,
  SimulateSaleRequest,
} from '@/features/sales/services/types'

export function useCreditSettings() {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useQuery({
    queryKey: creditSettingsKeys.detail(businessId),
    queryFn: () => getCreditSettings(businessId!),
    enabled: Boolean(businessId),
  })
}

export function usePutCreditSettingsMutation() {
  const queryClient = useQueryClient()
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useMutation({
    mutationFn: (payload: CreditSettingsWrite | CreditSettings) =>
      putCreditSettings(businessId!, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(creditSettingsKeys.detail(businessId), data)
      void queryClient.invalidateQueries({ queryKey: [...saleKeys.all, 'simulate'] })
    },
  })
}

export function useBusiness() {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  const switchingFrom = useSwitchingFromToken()
  return useQuery({
    queryKey: businessKeys.detail(businessId),
    queryFn: () => getBusiness(businessId!),
    enabled: Boolean(businessId) && !switchingFrom,
  })
}

export function usePatchBusinessMutation() {
  const queryClient = useQueryClient()
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useMutation({
    mutationFn: (payload: BusinessPatch) => patchBusiness(businessId!, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(businessKeys.detail(businessId), data)
    },
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
    queryKey: clientKeys.sales(businessId, clientId ?? ''),
    queryFn: () => listClientSales(clientId!),
    enabled: Boolean(clientId) && Boolean(businessId) && !switchingFrom,
  })
}

export function useSale(saleId: string | undefined) {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  const switchingFrom = useSwitchingFromToken()
  return useQuery({
    queryKey: saleKeys.detail(businessId, saleId ?? ''),
    queryFn: () => getSale(saleId!),
    enabled: Boolean(saleId) && Boolean(businessId) && !switchingFrom,
  })
}

export function useSalesList(status: '' | 'active' | 'voided') {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  const switchingFrom = useSwitchingFromToken()
  return useInfiniteQuery({
    queryKey: saleKeys.list(businessId, status),
    queryFn: ({ pageParam }) =>
      listSales({
        page: pageParam,
        page_size: 50,
        ...(status ? { status } : {}),
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const loaded = last.page * last.page_size
      if (loaded >= last.total || last.items.length === 0) return undefined
      return last.page + 1
    },
    enabled: Boolean(businessId) && !switchingFrom,
  })
}

export function useCreateSaleMutation(clientId: string) {
  const queryClient = useQueryClient()
  const businessId = useBusinessStore((s) => s.activeBusinessId)
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
      void queryClient.invalidateQueries({ queryKey: clientKeys.sales(businessId, clientId) })
    },
  })
}

export function useDownloadContractMutation() {
  return useMutation({
    mutationFn: downloadSaleContract,
  })
}

export function useVoidSaleMutation(saleId: string, clientId: string) {
  const queryClient = useQueryClient()
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useMutation({
    mutationFn: (reason: string) => voidSale(saleId, reason),
    onSuccess: (data) => {
      queryClient.setQueryData(saleKeys.detail(businessId, saleId), data)
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
      void queryClient.invalidateQueries({ queryKey: clientKeys.sales(businessId, clientId) })
      void queryClient.invalidateQueries({ queryKey: clientKeys.history(businessId, clientId) })
    },
  })
}

export async function refreshSessionRole() {
  const me = await getMe()
  useSessionStore.getState().applyMe(me)
  return me
}

export function invalidateSaleViews(
  queryClient: ReturnType<typeof useQueryClient>,
  businessId: string | null,
  saleId: string,
  clientId: string,
) {
  void queryClient.invalidateQueries({ queryKey: saleKeys.detail(businessId, saleId) })
  void queryClient.invalidateQueries({ queryKey: saleKeys.all })
  void queryClient.invalidateQueries({ queryKey: clientKeys.sales(businessId, clientId) })
  void queryClient.invalidateQueries({ queryKey: clientKeys.history(businessId, clientId) })
}
