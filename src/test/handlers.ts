import { http, HttpResponse } from 'msw'

import type {
  ClientCheckRequest,
  ClientCreate,
  ClientDetail,
  ClientSearchRequest,
  ClientUpdate,
  ContactCreate,
} from '@/features/clients/services/types'
import type { MemberCreate } from '@/features/members/services/types'
import {
  authResponse,
  businesses,
  cashierMember,
  clientFixture,
  collectorMember,
  membership,
  ownerMember,
  pendingInvite,
  users,
} from './fixtures'

const clients = new Map<string, ClientDetail>()
let createdCount = 0
let contactCount = 0

export const searchRequests: Array<{ method: string; url: string; body: unknown }> = []
export const listRequests: Array<{ method: string; url: string }> = []
export const checkRequests: Array<{ method: string; url: string; body: unknown }> = []

export function resetData() {
  clients.clear()
  createdCount = 0
  contactCount = 0
  searchRequests.length = 0
  listRequests.length = 0
  checkRequests.length = 0
}

function bearer(request: Request) {
  return request.headers.get('Authorization')
}

function requireAuth(request: Request) {
  const token = bearer(request)
  if (!token?.startsWith('Bearer ')) {
    return HttpResponse.json({ detail: 'no autenticado' }, { status: 401 })
  }
  if (token.includes('revoked') || token.includes('expired')) {
    return HttpResponse.json({ detail: 'no autenticado' }, { status: 401 })
  }
  return null
}

function roleFromToken(token: string | null): string {
  if (!token) return ''
  if (token.includes('owner')) return 'dueño'
  if (token.includes('collector')) return 'cobrador'
  return 'cajero'
}

function businessFromToken(token: string | null): string {
  if (token?.includes('sur')) return businesses.sur.id
  return businesses.norte.id
}

function sessionForToken(token: string) {
  if (token.includes('owner')) {
    return authResponse({
      user: users.owner,
      memberships: [membership(users.owner, businesses.norte, 'dueño')],
      token,
    })
  }
  if (token.includes('collector')) {
    return authResponse({
      user: users.collector,
      memberships: [membership(users.collector, businesses.norte, 'cobrador')],
      token,
    })
  }
  if (token.includes('pin')) {
    return authResponse({
      user: users.pin,
      memberships: [membership(users.cashier, businesses.norte, 'cajero', true)],
      token,
    })
  }
  if (token.includes('multi')) {
    const activeId = token.includes('sur') ? businesses.sur.id : businesses.norte.id
    return authResponse({
      user: users.multi,
      memberships: [
        membership(users.multi, businesses.norte, 'cajero'),
        membership(users.multi, businesses.sur, 'dueño'),
      ],
      token,
      needsBusinessSelection: !token.includes('norte') && !token.includes('sur'),
      activeBusinessId: token.includes('norte') || token.includes('sur') ? activeId : null,
    })
  }
  return authResponse({
    user: users.cashier,
    memberships: [membership(users.cashier, businesses.norte, 'cajero')],
    token,
  })
}

function visibleForBusiness(item: ClientDetail, biz: string) {
  if (biz === businesses.sur.id) return item.id.startsWith('cli-sur')
  return !item.id.startsWith('cli-sur')
}

export const handlers = [
  http.post('*/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    if (body.password === 'mala') {
      return HttpResponse.json({ detail: 'credenciales inválidas' }, { status: 401 })
    }
    if (body.email === users.owner.email) {
      return HttpResponse.json(
        authResponse({
          user: users.owner,
          memberships: [membership(users.owner, businesses.norte, 'dueño')],
          token: 'token-owner',
        }),
      )
    }
    if (body.email === users.collector.email) {
      return HttpResponse.json(
        authResponse({
          user: users.collector,
          memberships: [membership(users.collector, businesses.norte, 'cobrador')],
          token: 'token-collector',
        }),
      )
    }
    if (body.email === users.multi.email) {
      return HttpResponse.json(
        authResponse({
          user: users.multi,
          memberships: [
            membership(users.multi, businesses.norte, 'cajero'),
            membership(users.multi, businesses.sur, 'dueño'),
          ],
          token: 'token-multi',
          needsBusinessSelection: true,
        }),
      )
    }
    if (body.email === users.pin.email) {
      return HttpResponse.json(
        authResponse({
          user: users.pin,
          memberships: [membership(users.cashier, businesses.norte, 'cajero', true)],
          token: 'token-pin',
        }),
      )
    }
    return HttpResponse.json(
      authResponse({
        user: users.cashier,
        memberships: [membership(users.cashier, businesses.norte, 'cajero')],
        token: 'token-cashier',
      }),
    )
  }),

  http.post('*/auth/select-business', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const body = (await request.json()) as { business_id?: string }
    const biz =
      body.business_id === businesses.sur.id ? businesses.sur : businesses.norte
    return HttpResponse.json(
      authResponse({
        user: users.multi,
        memberships: [
          membership(users.multi, businesses.norte, 'cajero'),
          membership(users.multi, businesses.sur, 'dueño'),
        ],
        token: `token-multi-${biz.id === businesses.sur.id ? 'sur' : 'norte'}`,
        needsBusinessSelection: false,
        activeBusinessId: biz.id,
      }),
    )
  }),

  http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })),

  http.get('*/auth/me', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const token = bearer(request) ?? ''
    const session = sessionForToken(token)
    return HttpResponse.json({
      user: session.user,
      active_business: session.active_business,
      active_role: session.active_role,
      memberships: session.memberships,
    })
  }),

  http.post('*/auth/pin/unlock', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const body = (await request.json()) as { pin?: string }
    if (body.pin === '1234') {
      return HttpResponse.json(
        authResponse({
          user: users.pin,
          memberships: [membership(users.cashier, businesses.norte, 'cajero', true)],
          token: 'token-pin',
        }),
      )
    }
    return HttpResponse.json({ detail: 'credenciales inválidas' }, { status: 401 })
  }),

  http.post('*/auth/pin', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const body = (await request.json()) as { password?: string; pin?: string | null }
    if (!body.password) {
      return HttpResponse.json(
        {
          detail: [{ loc: ['body', 'password'], msg: 'Field required', type: 'missing' }],
        },
        { status: 422 },
      )
    }
    if (body.pin != null && !/^\d{4,6}$/.test(body.pin)) {
      return HttpResponse.json(
        {
          detail: [
            { loc: ['body', 'pin'], msg: 'el PIN debe ser de 4 a 6 dígitos', type: 'value_error' },
          ],
        },
        { status: 422 },
      )
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('*/invitations/accept', async ({ request }) => {
    const body = (await request.json()) as {
      token?: string
      name?: string
      password?: string
    }
    if (body.token !== 'inv-ok') {
      return HttpResponse.json({ detail: 'invitación inválida' }, { status: 400 })
    }
    if (!body.name || !body.password) {
      return HttpResponse.json(
        {
          detail: 'indica nombre y contraseña',
        },
        { status: 422 },
      )
    }
    return HttpResponse.json({
      business_id: businesses.norte.id,
      role: 'cajero',
      email: 'nuevo@negocio.com',
      role_unchanged: false,
    })
  }),

  http.get('*/invitations', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'dueño') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    return HttpResponse.json([pendingInvite])
  }),

  http.post('*/invitations/:id/revoke', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'dueño') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    return HttpResponse.json({ id: String(params.id), status: 'revoked' })
  }),

  http.post('*/clients/search', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const body = (await request.json()) as ClientSearchRequest
    searchRequests.push({ method: request.method, url: request.url, body })
    const biz = businessFromToken(bearer(request))
    const query = (body.q ?? body.name ?? body.document ?? body.phone ?? '').toLowerCase()
    const items = [...clients.values()].filter((item) => {
      if (!visibleForBusiness(item, biz)) return false
      if (!query) return true
      return `${item.name} ${item.document ?? ''} ${item.phone}`.toLowerCase().includes(query)
    })
    return HttpResponse.json({
      items,
      total: items.length,
      page: body.page ?? 1,
      page_size: body.page_size ?? 50,
    })
  }),

  http.post('*/clients/check', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const body = (await request.json()) as ClientCheckRequest
    checkRequests.push({ method: request.method, url: request.url, body })
    const found = [...clients.values()].some(
      (item) => item.document === body.document && item.doc_type === body.doc_type,
    )
    const duplicate = body.document === 'duplicado' || body.document === '001-0000000-0'
    return HttpResponse.json({
      found: found || duplicate,
      is_blocked: false,
      blocked_reason: null,
      client_id: found || duplicate ? 'cli-dup' : null,
    })
  }),

  http.get('*/clients/:id/history', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    if (![...url.searchParams.keys()].every((key) => key === 'limit' || key === 'before')) {
      return HttpResponse.json({ detail: 'parámetro de consulta no permitido' }, { status: 422 })
    }
    const before = url.searchParams.get('before')
    const empty = {
      purchases: [],
      payments: [],
      overdue: [],
      follow_ups: [],
    }
    if (!before) {
      return HttpResponse.json({
        ...empty,
        events: [
          {
            id: 'h1',
            type: 'blocked',
            occurred_at: '2026-01-02T10:00:00Z',
            actor: {
              user_id: users.cashier.id,
              membership_id: cashierMember.id,
            },
            reason: 'mora reiterada',
            from_collector_membership_id: null,
            to_collector_membership_id: null,
          },
        ],
        next_cursor: '2026-01-01T10:00:00Z,h2',
      })
    }
    return HttpResponse.json({
      ...empty,
      events: [
        {
          id: 'h2',
          type: 'collector_assigned',
          occurred_at: '2026-01-01T10:00:00Z',
          actor: {
            user_id: users.owner.id,
            membership_id: ownerMember.id,
          },
          reason: null,
          from_collector_membership_id: null,
          to_collector_membership_id: collectorMember.id,
        },
      ],
      next_cursor: null,
    })
  }),

  http.get('*/clients/:id/contacts', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const found = clients.get(String(params.id)) ?? clientFixture({ id: String(params.id) })
    return HttpResponse.json({ items: found.contacts })
  }),

  http.post('*/clients/:id/contacts', async ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) === 'cobrador') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const payload = (await request.json()) as ContactCreate
    contactCount += 1
    const id = String(params.id)
    const contact = {
      id: `ct-${contactCount}`,
      client_id: id,
      type: payload.type,
      name: payload.name,
      phone: payload.phone,
      relationship: payload.relationship,
      address: payload.address ?? null,
      doc_type: payload.doc_type ?? null,
      document: payload.document ?? null,
      has_document: Boolean(payload.document),
      document_available: true,
      is_active: true,
    }
    const current = clients.get(id) ?? clientFixture({ id })
    current.contacts = [...current.contacts, contact]
    clients.set(id, current)
    return HttpResponse.json(contact, { status: 201 })
  }),

  http.get('*/clients/:id', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const id = String(params.id)
    if (id === 'cli-blocked') {
      return HttpResponse.json(
        clientFixture({
          id,
          name: 'Luis Bloqueado',
          status: 'blocked',
          is_blocked: true,
          blocked_reason: 'No paga',
        }),
      )
    }
    if (id === 'cli-masked') {
      return HttpResponse.json(
        clientFixture({
          id,
          name: 'Cliente Ruta',
          document: '001-*****1234',
        }),
      )
    }
    const found = clients.get(id) ?? clientFixture({ id })
    return HttpResponse.json(found)
  }),

  http.patch('*/clients/:id', async ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const payload = (await request.json()) as ClientUpdate & { status?: unknown }
    if ('status' in payload) {
      return HttpResponse.json(
        {
          detail: [
            { loc: ['body', 'status'], msg: 'Extra inputs are not permitted', type: 'extra_forbidden' },
          ],
        },
        { status: 422 },
      )
    }
    const id = String(params.id)
    const current = clients.get(id) ?? clientFixture({ id })
    const saved = { ...current, ...payload }
    clients.set(id, saved)
    return HttpResponse.json(saved)
  }),

  http.post('*/clients/:id/block', async ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) === 'cobrador') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const payload = (await request.json()) as { reason?: string }
    if (!payload.reason?.trim()) {
      return HttpResponse.json(
        { detail: [{ loc: ['body', 'reason'], msg: 'el motivo es obligatorio', type: 'value_error' }] },
        { status: 422 },
      )
    }
    const current = clients.get(String(params.id))
    if (current?.is_blocked) {
      return HttpResponse.json({ detail: 'el cliente ya está bloqueado' }, { status: 409 })
    }
    return HttpResponse.json(
      clientFixture({
        id: String(params.id),
        status: 'blocked',
        is_blocked: true,
        blocked_reason: payload.reason,
      }),
    )
  }),

  http.post('*/clients/:id/unblock', async ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'dueño') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const payload = (await request.json()) as { reason?: string }
    if (!payload.reason?.trim()) {
      return HttpResponse.json(
        { detail: [{ loc: ['body', 'reason'], msg: 'el motivo es obligatorio', type: 'value_error' }] },
        { status: 422 },
      )
    }
    return HttpResponse.json(
      clientFixture({
        id: String(params.id),
        status: 'active',
        is_blocked: false,
        blocked_reason: null,
      }),
    )
  }),

  http.post('*/clients', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) === 'cobrador') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const payload = (await request.json()) as ClientCreate & { status?: unknown }
    if ('status' in payload) {
      return HttpResponse.json(
        {
          detail: [
            { loc: ['body', 'status'], msg: 'Extra inputs are not permitted', type: 'extra_forbidden' },
          ],
        },
        { status: 422 },
      )
    }
    if (payload.document === 'malo') {
      return HttpResponse.json(
        {
          detail: [
            {
              loc: ['body', 'document'],
              msg: 'El formato de la cédula no es válido.',
              type: 'value_error',
            },
          ],
        },
        { status: 422 },
      )
    }
    if (payload.document === '001-0000000-0' || payload.document === 'duplicado') {
      return HttpResponse.json(
        { detail: 'ya existe un cliente con este documento' },
        { status: 409 },
      )
    }
    createdCount += 1
    const saved = clientFixture({
      id: `cli-new-${createdCount}`,
      name: payload.name,
      doc_type: payload.doc_type,
      document: payload.document,
      phone: payload.phone,
      address: payload.address,
      notes: payload.notes ?? null,
      collector_membership_id: payload.collector_membership_id ?? null,
      contacts: [],
    })
    clients.set(saved.id, saved)
    return HttpResponse.json(saved, { status: 201 })
  }),

  http.get('*/clients', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    listRequests.push({ method: request.method, url: request.url })
    const url = new URL(request.url)
    for (const key of url.searchParams.keys()) {
      if (['document', 'q', 'name', 'phone'].includes(key)) {
        return HttpResponse.json(
          { detail: 'usa POST /clients/search para buscar por documento, nombre o teléfono' },
          { status: 422 },
        )
      }
      if (!['status', 'collector_membership_id', 'page', 'page_size'].includes(key)) {
        return HttpResponse.json({ detail: 'parámetro de consulta no permitido' }, { status: 422 })
      }
    }
    const biz = businessFromToken(bearer(request))
    const status = url.searchParams.get('status')
    const collector = url.searchParams.get('collector_membership_id')
    const items = [...clients.values()].filter((item) => {
      if (!visibleForBusiness(item, biz)) return false
      if (status && item.status !== status) return false
      if (collector && item.collector_membership_id !== collector) return false
      return true
    })
    return HttpResponse.json({
      items,
      total: items.length,
      page: Number(url.searchParams.get('page') ?? 1),
      page_size: Number(url.searchParams.get('page_size') ?? 50),
    })
  }),

  http.get('*/users', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'dueño') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    return HttpResponse.json([ownerMember, cashierMember, collectorMember])
  }),

  http.post('*/users', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'dueño') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const payload = (await request.json()) as MemberCreate
    return HttpResponse.json({ email: payload.email, role: payload.role }, { status: 201 })
  }),
]
