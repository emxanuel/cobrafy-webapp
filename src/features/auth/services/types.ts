export const ROLES = ['dueño', 'cajero', 'cobrador'] as const
export type Role = (typeof ROLES)[number]

export type UserRead = {
  id: string
  name: string
  email: string
  phone: string | null
  is_active: boolean
}

export type Membership = {
  id: string
  business_id: string
  business_name: string
  role: Role
  has_pin: boolean
}

export type BusinessSummary = {
  id: string
  name: string
  phone: string | null
  currency: string
  timezone: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type AuthResponse = {
  access_token: string
  token_type: 'bearer' | string
  expires_in: number
  needs_business_selection: boolean
  user: UserRead
  active_business: BusinessSummary | null
  active_role: Role | null
  memberships: Membership[]
}

export type MeResponse = {
  user: UserRead
  active_business: BusinessSummary | null
  active_role: Role | null
  memberships: Membership[]
}

export type SelectBusinessRequest = {
  business_id: string
}

export type PinUpdateRequest = {
  password: string
  pin: string | null
}

export type PinUnlockRequest = {
  pin: string
}

export type AcceptInvitationRequest = {
  token: string
  name?: string | null
  password?: string | null
}

export type InvitationAcceptRead = {
  business_id: string
  role: Role
  email: string
  role_unchanged: boolean
}
