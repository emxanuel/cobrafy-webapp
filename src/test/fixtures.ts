import type {
  AuthResponse,
  BusinessSummary,
  Membership,
  Role,
  UserRead,
} from '@/features/auth/services/types'
import type { ClientDetail } from '@/features/clients/services/types'
import type { InvitationRead, MemberRead } from '@/features/members/services/types'

export const users = {
  cashier: {
    id: 'user-cashier',
    name: 'Carla Caja',
    email: 'cajero@negocio.com',
    phone: null,
    is_active: true,
  },
  owner: {
    id: 'user-owner',
    name: 'Olivia Dueña',
    email: 'duena@negocio.com',
    phone: null,
    is_active: true,
  },
  collector: {
    id: 'user-collector',
    name: 'Coco Ruta',
    email: 'cobrador@negocio.com',
    phone: null,
    is_active: true,
  },
  multi: {
    id: 'user-multi',
    name: 'Marta Varios',
    email: 'marta@negocios.com',
    phone: null,
    is_active: true,
  },
  pin: {
    id: 'user-pin',
    name: 'Pilar Pin',
    email: 'pin@negocio.com',
    phone: null,
    is_active: true,
  },
} satisfies Record<string, UserRead>

export const businesses = {
  norte: {
    id: 'biz-norte',
    name: 'Créditos Norte',
    phone: null,
    currency: 'DOP',
    timezone: 'America/Santo_Domingo',
  },
  sur: {
    id: 'biz-sur',
    name: 'Créditos Sur',
    phone: null,
    currency: 'DOP',
    timezone: 'America/Santo_Domingo',
  },
} satisfies Record<string, BusinessSummary>

export function membership(
  user: UserRead,
  business: BusinessSummary,
  role: Role,
  hasPin = false,
): Membership {
  return {
    id: `mem-${user.id}-${business.id}`,
    business_id: business.id,
    business_name: business.name,
    role,
    has_pin: hasPin,
  }
}

export function authResponse(options: {
  user: UserRead
  memberships: Membership[]
  token?: string
  needsBusinessSelection?: boolean
  activeBusinessId?: string | null
}): AuthResponse {
  const needs =
    options.needsBusinessSelection ??
    (options.activeBusinessId == null && options.memberships.length !== 1)
  const activeId =
    options.activeBusinessId ?? (needs ? null : (options.memberships[0]?.business_id ?? null))
  const activeMembership =
    activeId == null
      ? null
      : (options.memberships.find((item) => item.business_id === activeId) ?? null)
  const biz = activeMembership
    ? (Object.values(businesses).find((item) => item.id === activeMembership.business_id) ?? {
        id: activeMembership.business_id,
        name: activeMembership.business_name,
        phone: null,
        currency: 'DOP',
        timezone: 'America/Santo_Domingo',
      })
    : null
  return {
    access_token: options.token ?? `token-${options.user.id}`,
    token_type: 'bearer',
    expires_in: 3600,
    needs_business_selection: needs || activeMembership == null,
    user: options.user,
    active_business: biz,
    active_role: activeMembership?.role ?? null,
    memberships: options.memberships,
  }
}

export const collectorMember: MemberRead = {
  id: membership(users.collector, businesses.norte, 'cobrador').id,
  name: users.collector.name,
  email: users.collector.email,
  role: 'cobrador',
  is_active: true,
  user_id: users.collector.id,
}

export const ownerMember: MemberRead = {
  id: membership(users.owner, businesses.norte, 'dueño').id,
  name: users.owner.name,
  email: users.owner.email,
  role: 'dueño',
  is_active: true,
  user_id: users.owner.id,
}

export const cashierMember: MemberRead = {
  id: membership(users.cashier, businesses.norte, 'cajero').id,
  name: users.cashier.name,
  email: users.cashier.email,
  role: 'cajero',
  is_active: true,
  user_id: users.cashier.id,
}

export function clientFixture(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    id: 'cli-1',
    name: 'Ana Pérez',
    doc_type: 'cedula',
    document: '001-1234567-8',
    document_available: true,
    phone: '8095551111',
    address: 'Calle 1',
    notes: null,
    collector_membership_id: collectorMember.id,
    status: 'active',
    is_blocked: false,
    blocked_reason: null,
    contacts: [],
    ...overrides,
  }
}

export const pendingInvite: InvitationRead = {
  id: 'inv-1',
  email: 'nuevo@negocio.com',
  role: 'cajero',
  status: 'pending',
  expires_at: '2026-01-05T00:00:00Z',
  created_at: '2026-01-02T00:00:00Z',
}
