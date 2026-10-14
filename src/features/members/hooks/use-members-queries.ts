import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useBusinessStore } from '@/features/business/stores/business-store'
import { memberKeys } from '@/features/members/query-keys'
import {
  inviteMember,
  listInvitations,
  listMembers,
  revokeInvitation,
} from '@/features/members/services/requests'
import type { MemberCreate } from '@/features/members/services/types'

export function useMembersQuery(enabled: boolean) {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useQuery({
    queryKey: memberKeys.list(businessId),
    queryFn: listMembers,
    enabled: enabled && Boolean(businessId),
  })
}

export function useInvitationsQuery(enabled: boolean) {
  const businessId = useBusinessStore((s) => s.activeBusinessId)
  return useQuery({
    queryKey: memberKeys.invitations(businessId),
    queryFn: listInvitations,
    enabled: enabled && Boolean(businessId),
  })
}

export function useInviteMemberMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: MemberCreate) => inviteMember(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.all })
    },
  })
}

export function useRevokeInvitationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.all })
    },
  })
}
