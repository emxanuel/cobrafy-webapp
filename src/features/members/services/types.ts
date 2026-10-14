import type { Role } from '@/features/auth/services/types'

export type Member = {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  role: Role
  status: 'active' | 'pending'
}

export type Invitation = {
  id: string
  email: string
  role: Role
  status: 'pending' | 'accepted' | 'cancelled' | 'expired'
  created_at: string
}

export type InviteMemberRequest = {
  email: string
  role: Exclude<Role, 'owner'> | Role
}
