import type { Role } from '@/features/auth/services/types'

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dueño',
  cashier: 'Cajero',
  collector: 'Cobrador',
}

export function canManageMembers(role: Role | null): boolean {
  return role === 'owner'
}

export function canUnblockClients(role: Role | null): boolean {
  return role === 'owner'
}

export function canEditClients(role: Role | null): boolean {
  return role === 'owner' || role === 'cashier'
}

export function canBlockClients(role: Role | null): boolean {
  return role === 'owner' || role === 'cashier'
}

export function canCreateClients(role: Role | null): boolean {
  return role === 'owner' || role === 'cashier'
}
