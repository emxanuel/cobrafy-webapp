import { beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { authResponse, businesses, cashierMember, membership, users } from '@/test/fixtures'
import { memberWrites } from '@/test/handlers'
import type { MemberUpdate } from './types'
import { patchMember } from './requests'

describe('patchMember', () => {
  beforeEach(() => {
    useSessionStore.getState().applyAuth(
      authResponse({
        user: users.owner,
        memberships: [membership(users.owner, businesses.norte, 'dueño')],
        token: 'token-owner',
      }),
    )
  })

  it('nunca manda name en PATCH /users/{id}', async () => {
    memberWrites.length = 0
    await patchMember(cashierMember.id, {
      role: 'cobrador',
      name: 'No debe ir',
    } as MemberUpdate)
    expect(memberWrites.at(-1)?.body).toEqual({ role: 'cobrador' })
    expect(memberWrites.at(-1)?.body).not.toHaveProperty('name')
  })
})
