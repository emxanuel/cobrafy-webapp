export const clientKeys = {
  all: ['clients'] as const,
  search: (businessId: string | null, query: string) =>
    [...clientKeys.all, 'search', businessId, query] as const,
  detail: (id: string) => [...clientKeys.all, 'detail', id] as const,
  history: (id: string) => [...clientKeys.all, 'history', id] as const,
}
