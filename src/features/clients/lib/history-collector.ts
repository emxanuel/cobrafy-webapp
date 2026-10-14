import type { Role } from '@/features/auth/services/types'
import type { HistoryEventType } from '@/features/clients/services/types'

export function collectorName(
  id: string | null,
  nameByMembership: Map<string, string>,
): string {
  if (!id) return 'Cobrador'
  return nameByMembership.get(id) ?? 'Cobrador'
}

export function collectorEventDetail(options: {
  role: Role | null
  membershipId: string | null
  type: Extract<HistoryEventType, 'collector_assigned' | 'collector_reassigned'>
  fromId: string | null
  toId: string | null
  nameByMembership: Map<string, string>
}): string {
  const { role, membershipId, type, fromId, toId, nameByMembership } = options
  if (role === 'cobrador') {
    return toId && toId === membershipId ? 'Asignado a ti' : 'Reasignado a otro cobrador'
  }
  if (type === 'collector_assigned') {
    return collectorName(toId, nameByMembership)
  }
  return `${collectorName(fromId, nameByMembership)} → ${collectorName(toId, nameByMembership)}`
}
