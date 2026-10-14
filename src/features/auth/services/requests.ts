import { api } from '@/features/shared/services/client'
import type {
  AcceptInvitationRequest,
  InvitationPreview,
  LoginRequest,
  PinRequest,
  SessionPayload,
} from './types'

export async function login(payload: LoginRequest): Promise<SessionPayload> {
  const { data } = await api.post<SessionPayload>('/auth/login', payload)
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function getMe(): Promise<Omit<SessionPayload, 'access_token' | 'token_type'>> {
  const { data } = await api.get<Omit<SessionPayload, 'access_token' | 'token_type'>>(
    '/auth/me',
  )
  return data
}

export async function setupPin(payload: PinRequest): Promise<void> {
  await api.post('/auth/pin', payload)
}

export async function unlockPin(payload: PinRequest): Promise<void> {
  await api.post('/auth/pin/unlock', payload)
}

export async function getInvitation(token: string): Promise<InvitationPreview> {
  const { data } = await api.get<InvitationPreview>(`/invitations/${token}`)
  return data
}

export async function acceptInvitation(
  token: string,
  payload: AcceptInvitationRequest,
): Promise<SessionPayload> {
  const { data } = await api.post<SessionPayload>(
    `/invitations/${token}/accept`,
    payload,
  )
  return data
}
