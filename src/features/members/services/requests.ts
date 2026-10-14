import { api } from '@/features/shared/services/client'
import type { Invitation, InviteMemberRequest, Member } from './types'

export async function listMembers(): Promise<{ items: Member[] }> {
  const { data } = await api.get<{ items: Member[] }>('/members')
  return data
}

export async function listInvitations(): Promise<{ items: Invitation[] }> {
  const { data } = await api.get<{ items: Invitation[] }>('/members/invitations')
  return data
}

export async function inviteMember(payload: InviteMemberRequest): Promise<Invitation> {
  const { data } = await api.post<Invitation>('/members/invitations', payload)
  return data
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  await api.delete(`/members/invitations/${invitationId}`)
}
