import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'

import { useSessionStore } from '@/features/auth/stores/session-store'
import { api } from '@/features/shared/services/client'
import { authResponse, businesses, membership, users } from '@/test/fixtures'
import { server } from '@/test/server'

describe('api 401 interceptor', () => {
  it('un 401 de un token viejo no cierra la sesión', async () => {
    useSessionStore.getState().applyAuth(
      authResponse({
        user: users.cashier,
        memberships: [membership(users.cashier, businesses.norte, 'cajero')],
        token: 'token-old',
      }),
    )

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('*/clients', async () => {
        await gate
        return HttpResponse.json({ detail: 'no autenticado' }, { status: 401 })
      }),
    )

    const pending = api.get('/clients')
    await Promise.resolve()
    useSessionStore.getState().applyAuth(
      authResponse({
        user: users.multi,
        memberships: [
          membership(users.multi, businesses.norte, 'cajero'),
          membership(users.multi, businesses.sur, 'dueño'),
        ],
        token: 'token-multi-sur',
        needsBusinessSelection: false,
        activeBusinessId: businesses.sur.id,
      }),
    )
    release()
    await pending.catch(() => undefined)
    await Promise.resolve()

    expect(useSessionStore.getState().accessToken).toBe('token-multi-sur')
    expect(useSessionStore.getState().user?.id).toBe(users.multi.id)
  })
})
