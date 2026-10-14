import { http, HttpResponse } from 'msw'

import type { ClientRead, ClientWrite } from '@/features/clients/services/types'
import {
  businesses,
  cashierMember,
  clientFixture,
  collectorMember,
  membership,
  ownerMember,
  pendingInvite,
  session,
  users,
} from './fixtures'

const clients = new Map<string, ClientRead>()
let createdCount = 0

export const searchRequests: Array<{ method: string; url: string; body: unknown }> = []

export function resetData() {
  clients.clear()
  createdCount = 0
  searchRequests.length = 0
}

function businessId(request: Request) {
  return request.headers.get('X-Business-Id')
}

function bearer(request: Request) {
  return request.headers.get('Authorization')
}

function requireAuth(request: Request) {
  const token = bearer(request)
  if (!token?.startsWith('Bearer ')) {
    return HttpResponse.json({ detail: 'No autenticado' }, { status: 401 })
  }
  if (token.includes('revoked') || token.includes('expired')) {
    return HttpResponse.json({ detail: 'Sesión caducada' }, { status: 401 })
  }
  return null
}

function roleFromToken(token: string | null): string {
  if (!token) return ''
  if (token.includes('owner')) return 'owner'
  if (token.includes('collector')) return 'collector'
  if (token.includes('multi')) return 'cashier'
  return 'cashier'
}

export const handlers = [
  http.post('*/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    if (body.password === 'mala') {
      return HttpResponse.json({ detail: 'Correo o contraseña incorrectos' }, { status: 401 })
    }
    if (body.email === users.owner.email) {
      return HttpResponse.json(
        session({
          user: users.owner,
          memberships: [membership(users.owner, businesses.norte, 'owner')],
          token: 'token-owner',
        }),
      )
    }
    if (body.email === users.collector.email) {
      return HttpResponse.json(
        session({
          user: users.collector,
          memberships: [membership(users.collector, businesses.norte, 'collector')],
          token: 'token-collector',
        }),
      )
    }
    if (body.email === users.multi.email) {
      return HttpResponse.json(
        session({
          user: users.multi,
          memberships: [
            membership(users.multi, businesses.norte, 'cashier'),
            membership(users.multi, businesses.sur, 'owner'),
          ],
          token: 'token-multi',
        }),
      )
    }
    if (body.email === 'pin@negocio.com') {
      return HttpResponse.json(
        session({
          user: { ...users.cashier, email: 'pin@negocio.com', id: 'user-pin' },
          memberships: [membership(users.cashier, businesses.norte, 'cashier')],
          pinConfigured: true,
          token: 'token-pin',
        }),
      )
    }
    return HttpResponse.json(
      session({
        user: users.cashier,
        memberships: [membership(users.cashier, businesses.norte, 'cashier')],
        token: 'token-cashier',
      }),
    )
  }),

  http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })),

  http.post('*/auth/pin', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const body = (await request.json()) as { pin?: string }
    if (!body.pin || !/^\d{4,6}$/.test(body.pin)) {
      return HttpResponse.json(
        {
          detail: [
            { loc: ['body', 'pin'], msg: 'La clave rápida son 4 a 6 números.', type: 'value_error' },
          ],
        },
        { status: 422 },
      )
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('*/auth/pin/unlock', async ({ request }) => {
    const body = (await request.json()) as { pin?: string }
    if (body.pin === '1234') return new HttpResponse(null, { status: 204 })
    return HttpResponse.json({ detail: 'Clave incorrecta.' }, { status: 401 })
  }),

  http.get('*/invitations/:token', ({ params }) => {
    if (params.token === 'inv-ok') {
      return HttpResponse.json({
        token: 'inv-ok',
        email: 'nuevo@negocio.com',
        business_name: businesses.norte.name,
        role: 'cashier',
        status: 'pending',
      })
    }
    return HttpResponse.json({ detail: 'Invitación no válida' }, { status: 404 })
  }),

  http.post('*/invitations/:token/accept', async ({ params, request }) => {
    if (params.token !== 'inv-ok') {
      return HttpResponse.json({ detail: 'Invitación no válida' }, { status: 404 })
    }
    const body = (await request.json()) as { first_name: string; last_name: string }
    return HttpResponse.json(
      session({
        user: {
          id: 'user-new',
          first_name: body.first_name,
          last_name: body.last_name,
          email: 'nuevo@negocio.com',
        },
        memberships: [
          membership(
            { id: 'user-new', first_name: body.first_name, last_name: body.last_name, email: 'nuevo@negocio.com' },
            businesses.norte,
            'cashier',
          ),
        ],
        token: 'token-new',
      }),
    )
  }),

  http.post('*/clients/search', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await request.json()
    searchRequests.push({ method: request.method, url: request.url, body })
    const query = String((body as { query?: string }).query ?? '').toLowerCase()
    const biz = businessId(request)
    const items = [...clients.values()].filter((item) => {
      if (query && !`${item.full_name} ${item.document_number}`.toLowerCase().includes(query)) {
        return false
      }
      if (biz === businesses.sur.id) return item.id.startsWith('cli-sur')
      return !item.id.startsWith('cli-sur')
    })
    return HttpResponse.json({ items, next_cursor: null })
  }),

  http.post('*/clients', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) === 'collector') {
      return HttpResponse.json({ detail: 'No tienes permiso para hacer esto.' }, { status: 403 })
    }
    const payload = (await request.json()) as ClientWrite
    if (payload.document_number === 'malo') {
      return HttpResponse.json(
        {
          detail: [
            {
              loc: ['body', 'document_number'],
              msg: 'El formato de la cédula no es válido.',
              type: 'value_error',
            },
          ],
        },
        { status: 422 },
      )
    }
    if (payload.document_number === '001-0000000-0' || payload.document_number === 'duplicado') {
      return HttpResponse.json(
        { detail: 'Ya existe un cliente con este documento' },
        { status: 409 },
      )
    }
    createdCount += 1
    const saved = clientFixture({
      id: `cli-new-${createdCount}`,
      first_name: payload.first_name,
      last_name: payload.last_name,
      full_name: `${payload.first_name} ${payload.last_name}`,
      document_type: payload.document_type,
      document_number: payload.document_number,
      phone: payload.phone,
      email: payload.email ?? null,
      address: payload.address ?? null,
      collector_id: payload.collector_id ?? null,
      collector_name: payload.collector_id ? 'Coco Ruta' : null,
      references: payload.references,
      guarantors: payload.guarantors,
    })
    clients.set(saved.id, saved)
    return HttpResponse.json(saved, { status: 201 })
  }),

  http.get('*/clients/:id/history', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    if (!cursor) {
      return HttpResponse.json({
        items: [
          {
            id: 'h1',
            occurred_at: '2026-01-01T10:00:00Z',
            actor_name: 'Carla Caja',
            summary: 'Alta de la ficha',
          },
        ],
        next_cursor: `hist-${params.id}-2`,
      })
    }
    return HttpResponse.json({
      items: [
        {
          id: 'h2',
          occurred_at: '2026-01-02T10:00:00Z',
          actor_name: 'Olivia Dueña',
          summary: 'Se asignó cobrador',
        },
      ],
      next_cursor: null,
    })
  }),

  http.get('*/clients/:id', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const id = String(params.id)
    if (id === 'cli-blocked') {
      return HttpResponse.json(
        clientFixture({
          id,
          status: 'blocked',
          blocked_reason: 'No paga',
          full_name: 'Luis Bloqueado',
          first_name: 'Luis',
          last_name: 'Bloqueado',
        }),
      )
    }
    if (id === 'cli-masked') {
      return HttpResponse.json(
        clientFixture({
          id,
          document_number: '001-*****1234',
          full_name: 'Cliente Ruta',
        }),
      )
    }
    const found = clients.get(id) ?? clientFixture({ id })
    return HttpResponse.json(found)
  }),

  http.patch('*/clients/:id', async ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const payload = (await request.json()) as ClientWrite
    const saved = clientFixture({
      id: String(params.id),
      ...payload,
      full_name: `${payload.first_name} ${payload.last_name}`,
    })
    clients.set(saved.id, saved)
    return HttpResponse.json(saved)
  }),

  http.post('*/clients/:id/block', async ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const payload = (await request.json()) as { reason?: string }
    if (!payload.reason) {
      return HttpResponse.json(
        { detail: [{ loc: ['body', 'reason'], msg: 'Di por qué se bloquea.', type: 'value_error' }] },
        { status: 422 },
      )
    }
    return HttpResponse.json(
      clientFixture({
        id: String(params.id),
        status: 'blocked',
        blocked_reason: payload.reason,
      }),
    )
  }),

  http.post('*/clients/:id/unblock', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'owner') {
      return HttpResponse.json({ detail: 'No tienes permiso para desbloquear.' }, { status: 403 })
    }
    return HttpResponse.json(clientFixture({ id: String(params.id), status: 'active' }))
  }),

  http.get('*/members/invitations', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'owner') {
      return HttpResponse.json({ detail: 'No tienes permiso para hacer esto.' }, { status: 403 })
    }
    return HttpResponse.json({ items: [pendingInvite] })
  }),

  http.post('*/members/invitations', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'owner') {
      return HttpResponse.json({ detail: 'No tienes permiso para hacer esto.' }, { status: 403 })
    }
    const payload = (await request.json()) as { email: string; role: 'cashier' | 'collector' }
    return HttpResponse.json(
      { id: 'inv-new', email: payload.email, role: payload.role, status: 'pending', created_at: new Date().toISOString() },
      { status: 201 },
    )
  }),

  http.delete('*/members/invitations/:id', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/members', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    return HttpResponse.json({ items: [ownerMember, cashierMember, collectorMember] })
  }),
]
