import { describe, expect, it, vi } from 'vitest'
import { delay, http, HttpResponse } from 'msw'

import { setSwitchingFromToken } from '@/features/auth/lib/switching-token'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { isApiError } from '@/features/shared/lib/api-error'
import { GET_TIMEOUT_MS, api } from '@/features/shared/services/client'
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

  it('un 401 del token en switchingFromToken no cierra la sesión', async () => {
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
    setSwitchingFromToken('token-old')
    release()
    await pending.catch(() => undefined)
    await Promise.resolve()

    expect(useSessionStore.getState().accessToken).toBe('token-old')
    expect(useSessionStore.getState().user?.id).toBe(users.cashier.id)
    setSwitchingFromToken(null)
  })

  it('un 401 con el token nuevo cierra la sesión', async () => {
    useSessionStore.getState().applyAuth(
      authResponse({
        user: users.cashier,
        memberships: [membership(users.cashier, businesses.norte, 'cajero')],
        token: 'token-new',
      }),
    )
    setSwitchingFromToken('token-old')
    server.use(
      http.get('*/clients', () =>
        HttpResponse.json({ detail: 'no autenticado' }, { status: 401 }),
      ),
    )
    await api.get('/clients').catch(() => undefined)
    await Promise.resolve()
    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(useSessionStore.getState().user).toBeNull()
  })
})

describe('api timeouts', () => {
  it('un GET se cancela a los 15 s', async () => {
    expect(api.defaults.timeout).toBeFalsy()
    server.use(
      http.get('*/clients', async () => {
        await delay('infinite')
        return HttpResponse.json({ items: [] })
      }),
    )
    vi.useFakeTimers()
    try {
      const pending = api.get('/clients')
      const rejected = expect(pending).rejects.toSatisfy(
        (error) => isApiError(error) && error.status === 0,
      )
      await vi.advanceTimersByTimeAsync(GET_TIMEOUT_MS)
      await rejected
    } finally {
      vi.useRealTimers()
    }
  })
})
