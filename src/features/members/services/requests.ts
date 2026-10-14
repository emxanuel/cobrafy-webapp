import { api } from '@/features/shared/services/client'
import type {
  InvitationRead,
  InvitationRevokedRead,
  MemberCreate,
  MemberInviteRead,
  MemberRead,
  MemberUpdate,
} from './types'

export async function listMembers(): Promise<MemberRead[]> {
  const { data } = await api.get<MemberRead[]>('/users')
  return data
}

export async function inviteMember(payload: MemberCreate): Promise<MemberInviteRead> {
  const { data } = await api.post<MemberInviteRead>('/users', payload)
  return data
}

export async function patchMember(
  memberId: string,
  payload: MemberUpdate,
): Promise<MemberRead> {
  const body: MemberUpdate = {}
  if (payload.role !== undefined) body.role = payload.role
  if (payload.is_active !== undefined) body.is_active = payload.is_active
  const { data } = await api.patch<MemberRead>(`/users/${memberId}`, body)
  return data
}

export async function listInvitations(): Promise<InvitationRead[]> {
  const { data } = await api.get<InvitationRead[]>('/invitations')
  return data
}

export async function revokeInvitation(
  invitationId: string,
): Promise<InvitationRevokedRead> {
  const { data } = await api.post<InvitationRevokedRead>(
    `/invitations/${invitationId}/revoke`,
  )
  return data
}
