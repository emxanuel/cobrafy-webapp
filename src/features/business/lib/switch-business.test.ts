import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'

import { getSwitchingFromToken, setSwitchingFromToken } from '@/features/auth/lib/switching-token'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { switchBusiness } from '@/features/business/lib/switch-business'
import { getQueryClient } from '@/query-client'
import { authResponse, businesses, membership, users } from '@/test/fixtures'
import { server } from '@/test/server'

function seedMultiNorte() {
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
}

describe('switchBusiness', () => {
  it('limpia switchingFromToken aunque selectBusiness falle', async () => {
    seedMultiNorte()
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

  it('aplica la sesión nueva antes de navegar y no usa el token viejo después del clear', async () => {
    seedMultiNorte()
    const order: string[] = []
    const tokensAfterClear: string[] = []
    let cleared = false
    const client = getQueryClient()
    const originalClear = client.clear.bind(client)
    vi.spyOn(client, 'clear').mockImplementation(() => {
      originalClear()
      cleared = true
      order.push('clear')
    })
    const originalApply = useSessionStore.getState().applyAuth
    useSessionStore.setState({
      applyAuth: (payload, options) => {
        order.push('applyAuth')
        originalApply(payload, options)
      },
    })
    const onRequest = ({ request }: { request: Request }) => {
      if (!cleared) return
      tokensAfterClear.push(request.headers.get('Authorization') ?? '')
    }
    server.events.on('request:start', onRequest)

    try {
      await switchBusiness(client, businesses.sur.id, () => {
        order.push('afterAuth')
      })
    } finally {
      server.events.removeListener('request:start', onRequest)
      useSessionStore.setState({ applyAuth: originalApply })
    }

    expect(order).toEqual(['clear', 'applyAuth', 'afterAuth'])
    expect(useSessionStore.getState().accessToken).toBe('token-multi-sur')
    expect(tokensAfterClear.every((token) => !token.includes('norte'))).toBe(true)
  })
})
