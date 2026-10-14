import { api } from '@/features/shared/services/client'
import type {
  AcceptInvitationRequest,
  AuthResponse,
  InvitationAcceptRead,
  LoginRequest,
  MeResponse,
  PinUnlockRequest,
  PinUpdateRequest,
  SelectBusinessRequest,
} from './types'

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload)
  return data
}

export async function selectBusiness(
  payload: SelectBusinessRequest,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/select-business', payload)
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me')
  return data
}

export async function setupPin(payload: PinUpdateRequest): Promise<void> {
  await api.post('/auth/pin', payload)
}

export async function unlockPin(payload: PinUnlockRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/pin/unlock', payload)
  return data
}

export async function acceptInvitation(
  payload: AcceptInvitationRequest,
): Promise<InvitationAcceptRead> {
  const { data } = await api.post<InvitationAcceptRead>('/invitations/accept', payload)
  return data
}
