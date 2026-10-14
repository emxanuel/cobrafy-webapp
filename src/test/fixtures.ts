import type { Membership, SessionPayload, UserRead } from '@/features/auth/services/types'
import type { ClientRead } from '@/features/clients/services/types'
import type { Invitation, Member } from '@/features/members/services/types'

export const users = {
  cashier: {
    id: 'user-cashier',
    first_name: 'Carla',
    last_name: 'Caja',
    email: 'cajero@negocio.com',
  },
  owner: {
    id: 'user-owner',
    first_name: 'Olivia',
    last_name: 'Dueña',
    email: 'duena@negocio.com',
  },
  collector: {
    id: 'user-collector',
    first_name: 'Coco',
    last_name: 'Ruta',
    email: 'cobrador@negocio.com',
  },
  multi: {
    id: 'user-multi',
    first_name: 'Marta',
    last_name: 'Varios',
    email: 'marta@negocios.com',
  },
} satisfies Record<string, UserRead>

export const businesses = {
  norte: { id: 'biz-norte', name: 'Créditos Norte' },
  sur: { id: 'biz-sur', name: 'Créditos Sur' },
}

export function membership(
  user: UserRead,
  business: { id: string; name: string },
  role: Membership['role'],
): Membership {
  return {
    id: `mem-${user.id}-${business.id}`,
    business_id: business.id,
    business_name: business.name,
    role,
  }
}

export function session(options: {
  user: UserRead
  memberships: Membership[]
  pinConfigured?: boolean
  token?: string
}): SessionPayload {
  return {
    access_token: options.token ?? `token-${options.user.id}`,
    token_type: 'bearer',
    user: options.user,
    memberships: options.memberships,
    pin_configured: options.pinConfigured ?? false,
  }
}

export const collectorMember: Member = {
  id: 'mem-collector',
  user_id: users.collector.id,
  first_name: users.collector.first_name,
  last_name: users.collector.last_name,
  email: users.collector.email,
  role: 'collector',
  status: 'active',
}

export const ownerMember: Member = {
  id: 'mem-owner',
  user_id: users.owner.id,
  first_name: users.owner.first_name,
  last_name: users.owner.last_name,
  email: users.owner.email,
  role: 'owner',
  status: 'active',
}

export const cashierMember: Member = {
  id: 'mem-cashier',
  user_id: users.cashier.id,
  first_name: users.cashier.first_name,
  last_name: users.cashier.last_name,
  email: users.cashier.email,
  role: 'cashier',
  status: 'active',
}

export function clientFixture(overrides: Partial<ClientRead> = {}): ClientRead {
  return {
    id: 'cli-1',
    first_name: 'Ana',
    last_name: 'Pérez',
    full_name: 'Ana Pérez',
    document_type: 'cedula',
    document_number: '001-1234567-8',
    phone: '8095551111',
    email: null,
    address: 'Calle 1',
    notes: null,
    collector_id: users.collector.id,
    collector_name: 'Coco Ruta',
    status: 'active',
    blocked_reason: null,
    references: [],
    guarantors: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export const pendingInvite: Invitation = {
  id: 'inv-1',
  email: 'nuevo@negocio.com',
  role: 'cashier',
  status: 'pending',
  created_at: '2026-01-02T00:00:00Z',
}
