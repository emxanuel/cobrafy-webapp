export const memberKeys = {
  all: ['members'] as const,
  list: (businessId: string | null) => [...memberKeys.all, 'list', businessId] as const,
  invitations: (businessId: string | null) =>
    [...memberKeys.all, 'invitations', businessId] as const,
}
