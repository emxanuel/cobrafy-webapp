export const ROLES = ['owner', 'cashier', 'collector'] as const
export type Role = (typeof ROLES)[number]

export type UserRead = {
  id: string
  first_name: string
  last_name: string
  email: string
}

export type Membership = {
  id: string
  business_id: string
  business_name: string
  role: Role
}

export type LoginRequest = {
  email: string
  password: string
}

export type SessionPayload = {
  access_token: string
  token_type: 'bearer'
  user: UserRead
  memberships: Membership[]
  pin_configured: boolean
}

export type PinRequest = {
  pin: string
}

export type AcceptInvitationRequest = {
  first_name: string
  last_name: string
  password: string
}

export type InvitationPreview = {
  token: string
  email: string
  business_name: string
  role: Role
  status: 'pending' | 'accepted' | 'cancelled' | 'expired'
}
