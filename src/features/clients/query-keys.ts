export const clientKeys = {
  all: ['clients'] as const,
  search: (businessId: string | null, query: string, status: string) =>
    [...clientKeys.all, 'search', businessId, query, status] as const,
  detail: (businessId: string | null, id: string) =>
    [...clientKeys.all, 'detail', businessId, id] as const,
  history: (businessId: string | null, id: string) =>
    [...clientKeys.all, 'history', businessId, id] as const,
  sales: (id: string) => [...clientKeys.all, id, 'sales'] as const,
}
