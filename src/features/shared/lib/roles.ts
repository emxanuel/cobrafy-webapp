import type { Role } from '@/features/auth/services/types'

export const ROLE_LABEL: Record<Role, string> = {
  dueño: 'Dueño',
  cajero: 'Cajero',
  cobrador: 'Cobrador',
}

export function canManageMembers(role: Role | null): boolean {
  return role === 'dueño'
}

export function canUnblockClients(role: Role | null): boolean {
  return role === 'dueño'
}

export function canEditClients(role: Role | null): boolean {
  return role === 'dueño' || role === 'cajero'
}

export function canBlockClients(role: Role | null): boolean {
  return role === 'dueño' || role === 'cajero'
}

export function canCreateClients(role: Role | null): boolean {
  return role === 'dueño' || role === 'cajero'
}

export function canSeeHistoryActor(role: Role | null): boolean {
  return role === 'dueño' || role === 'cajero'
}

export function canViewAudit(role: Role | null): boolean {
  return role === 'dueño'
}
