import type { Role } from '@/features/auth/services/types'

export type MemberRead = {
  id: string
  name: string
  email: string
  role: Role
  is_active: boolean
}

export type MemberInviteRead = {
  email: string
  role: Role
}

export type MemberCreate = {
  email: string
  role: Role
}

export type MemberUpdate = {
  role?: Role
  is_active?: boolean
}

export type InvitationRead = {
  id: string
  email: string
  role: Role
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
  created_at: string
}

export type InvitationRevokedRead = {
  id: string
  status: InvitationRead['status']
}
