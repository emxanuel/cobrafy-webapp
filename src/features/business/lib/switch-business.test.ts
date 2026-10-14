import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'

import { getSwitchingFromToken, setSwitchingFromToken } from '@/features/auth/lib/switching-token'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { switchBusiness } from '@/features/business/lib/switch-business'
import { getQueryClient } from '@/query-client'
import { authResponse, businesses, membership, users } from '@/test/fixtures'
import { server } from '@/test/server'

describe('switchBusiness', () => {
  it('limpia switchingFromToken aunque selectBusiness falle', async () => {
    useSessionStore.getState().applyAuth(
      authResponse({
        user: users.multi,
        memberships: [
          membership(users.multi, businesses.norte, 'cajero'),
          membership(users.multi, businesses.sur, 'dueño'),
        ],
        token: 'token-multi-norte',
        activeBusinessId: businesses.norte.id,
      }),
    )
    setSwitchingFromToken(null)
    server.use(
      http.post('*/auth/select-business', () =>
        HttpResponse.json({ detail: 'no se pudo cambiar' }, { status: 500 }),
      ),
    )

    await expect(switchBusiness(getQueryClient(), businesses.sur.id)).rejects.toMatchObject({
      status: 500,
    })
    expect(getSwitchingFromToken()).toBeNull()
  })
})
