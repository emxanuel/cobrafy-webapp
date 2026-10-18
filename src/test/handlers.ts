import { http, HttpResponse } from 'msw'

import type {
  ClientCheckRequest,
  ClientCreate,
  ClientDetail,
  ClientSearchRequest,
  ClientUpdate,
  ContactCreate,
} from '@/features/clients/services/types'
import type { ContactUpdate } from '@/features/clients/services/types'
import type { MemberCreate, MemberRead, MemberUpdate } from '@/features/members/services/types'
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
let pinFailures = 0
let membersState: MemberRead[] = []

export const searchRequests: Array<{ method: string; url: string; body: unknown }> = []
export const listRequests: Array<{ method: string; url: string }> = []
export const checkRequests: Array<{ method: string; url: string; body: unknown }> = []
export const clientDetailRequests: Array<{ id: string; token: string }> = []
export const logoutRequests: Array<{ token: string | null }> = []
export const contactWrites: Array<{ method: string; url: string; body: unknown }> = []
export const clientWrites: Array<{ method: string; url: string; body: unknown }> = []
export const memberWrites: Array<{ method: string; url: string; body: unknown }> = []
export const auditRequests: Array<{ method: string; url: string }> = []
export const saleWrites: Array<{
  method: string
  url: string
  body: unknown
  idempotencyKey: string | null
}> = []
const revokedTokens = new Set<string>()
const sales = new Map<string, Record<string, unknown>>()
let saleCount = 0

export function seedClient(client: ClientDetail) {
  clients.set(client.id, client)
}

const MAX_PIN_ATTEMPTS = 5
const PIN_LOCKED = 'demasiados intentos; entra con contraseña'

function resetMembers() {
  membersState = [
    { ...ownerMember },
    { ...cashierMember },
    { ...collectorMember },
  ]
}

resetMembers()

export function resetData() {
  clients.clear()
  clients.set(
    'cli-sur-1',
    clientFixture({
      id: 'cli-sur-1',
      name: 'Sofía Sur',
      document: '001-2222222-2',
    }),
  )
  createdCount = 0
  contactCount = 0
  pinFailures = 0
  resetMembers()
  searchRequests.length = 0
  listRequests.length = 0
  checkRequests.length = 0
  clientDetailRequests.length = 0
  logoutRequests.length = 0
  contactWrites.length = 0
  clientWrites.length = 0
  memberWrites.length = 0
  auditRequests.length = 0
  saleWrites.length = 0
  sales.clear()
  saleCount = 0
  revokedTokens.clear()
}

resetData()

function bearer(request: Request) {
  return request.headers.get('Authorization')
}

function tokenValue(request: Request) {
  const header = bearer(request)
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

function requireAuth(request: Request) {
  const token = tokenValue(request)
  if (!token) {
    return HttpResponse.json({ detail: 'no autenticado' }, { status: 401 })
  }
  if (revokedTokens.has(token) || token.includes('revoked') || token.includes('expired')) {
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

function buildAuditEvents() {
  const base = {
    business_id: businesses.norte.id,
    ip: '127.0.0.1',
    user_agent: 'vitest',
  }
  const events: Array<{
    id: string
    business_id: string
    user_id: string
    membership_id: string
    action: string
    entity: string
    entity_id: string
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    ip: string
    user_agent: string
    created_at: string
  }> = [
    {
      ...base,
      id: 'aud-1',
      user_id: users.owner.id,
      membership_id: ownerMember.id,
      action: 'block',
      entity: 'client',
      entity_id: 'cli-1',
      before: { status: 'active', blocked_reason: null },
      after: { status: 'blocked', blocked_reason: 'Atraso de 3 cuotas' },
      created_at: '2026-10-14T12:41:00.000Z',
    },
    {
      ...base,
      id: 'aud-2',
      user_id: users.cashier.id,
      membership_id: cashierMember.id,
      action: 'update',
      entity: 'client',
      entity_id: 'cli-1',
      before: { document: '001-1234567-8', phone: '809-555-0101' },
      after: { document: '001-7654321-0', phone: '809-555-0199' },
      created_at: '2026-10-13T20:10:00.000Z',
    },
    {
      ...base,
      id: 'aud-3',
      user_id: users.owner.id,
      membership_id: ownerMember.id,
      action: 'update',
      entity: 'client',
      entity_id: 'cli-1',
      before: { collector_membership_id: collectorMember.id },
      after: { collector_membership_id: 'mem-rosa' },
      created_at: '2026-10-12T13:02:00.000Z',
    },
    {
      ...base,
      id: 'aud-4',
      user_id: users.owner.id,
      membership_id: ownerMember.id,
      action: 'create',
      entity: 'contact',
      entity_id: 'ct-1',
      before: null,
      after: { name: 'Pedro Gómez', phone: '8095552222' },
      created_at: '2026-10-11T15:00:00.000Z',
    },
    {
      ...base,
      id: 'aud-5',
      user_id: users.owner.id,
      membership_id: ownerMember.id,
      action: 'update',
      entity: 'business',
      entity_id: businesses.norte.id,
      before: { phone: null },
      after: { phone: '8095550000' },
      created_at: '2026-10-10T15:00:00.000Z',
    },
    {
      ...base,
      id: 'aud-6',
      user_id: users.owner.id,
      membership_id: ownerMember.id,
      action: 'login',
      entity: 'user',
      entity_id: users.owner.id,
      before: null,
      after: null,
      created_at: '2026-10-09T12:00:00.000Z',
    },
    {
      ...base,
      id: 'aud-7',
      user_id: users.owner.id,
      membership_id: ownerMember.id,
      action: 'select_business',
      entity: 'business',
      entity_id: businesses.norte.id,
      before: null,
      after: { business_id: businesses.norte.id },
      created_at: '2026-10-08T12:00:00.000Z',
    },
  ]
  for (let index = 8; index <= 25; index += 1) {
    events.push({
      ...base,
      id: `aud-${index}`,
      user_id: users.cashier.id,
      membership_id: cashierMember.id,
      action: 'update',
      entity: 'client',
      entity_id: 'cli-1',
      before: { notes: `antes ${index}` },
      after: { notes: `después ${index}` },
      created_at: `2026-09-${String(Math.max(1, 30 - index)).padStart(2, '0')}T12:00:00.000Z`,
    })
  }
  return events
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
    const previous = tokenValue(request)
    if (previous) revokedTokens.add(previous)
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

  http.post('*/auth/logout', ({ request }) => {
    logoutRequests.push({ token: bearer(request) })
    return new HttpResponse(null, { status: 204 })
  }),

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
      pinFailures = 0
      return HttpResponse.json(
        authResponse({
          user: users.pin,
          memberships: [membership(users.cashier, businesses.norte, 'cajero', true)],
          token: 'token-pin',
        }),
      )
    }
    pinFailures += 1
    if (pinFailures >= MAX_PIN_ATTEMPTS) {
      return HttpResponse.json({ detail: PIN_LOCKED }, { status: 401 })
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
    const normalized = body.document.replace(/[\s-]/g, '')
    const found = [...clients.values()].find((item) => {
      const itemDoc = (item.document ?? '').replace(/[\s-]/g, '')
      return itemDoc === normalized && item.doc_type === body.doc_type
    })
    if (normalized === '00188888888' && body.doc_type === 'cedula') {
      return HttpResponse.json({
        found: true,
        is_blocked: true,
        blocked_reason: 'Atraso de 3 cuotas. Doc 001-8888888-8',
        client_id: 'cli-blocked',
      })
    }
    if (normalized === '00112345678' && body.doc_type === 'cedula') {
      return HttpResponse.json({
        found: true,
        is_blocked: false,
        blocked_reason: null,
        client_id: 'cli-1',
      })
    }
    const duplicate = body.document === 'duplicado' || body.document === '001-0000000-0'
    return HttpResponse.json({
      found: Boolean(found) || duplicate,
      is_blocked: found?.is_blocked ?? false,
      blocked_reason: found?.blocked_reason ?? null,
      client_id: found?.id ?? (duplicate ? 'cli-dup' : null),
    })
  }),

  http.get('*/clients/:id/history', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    if (![...url.searchParams.keys()].every((key) => key === 'limit' || key === 'before')) {
      return HttpResponse.json({ detail: 'parámetro de consulta no permitido' }, { status: 422 })
    }
    const id = String(params.id)
    if (id === 'cli-missing') {
      return HttpResponse.json({ detail: 'recurso no encontrado' }, { status: 404 })
    }
    const before = url.searchParams.get('before')
    const empty = {
      purchases: [],
      payments: [],
      overdue: [],
      follow_ups: [],
    }
    if (id === 'cli-empty-history') {
      return HttpResponse.json({ ...empty, events: [], next_cursor: null })
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
            reason: 'mora reiterada 001-1234567-8',
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
    contactWrites.push({ method: request.method, url: request.url, body: payload })
    const id = String(params.id)
    const current = clients.get(id) ?? clientFixture({ id })
    const activeCount = current.contacts.filter((item) => item.is_active).length
    if (activeCount >= 50) {
      return HttpResponse.json(
        { detail: 'el cliente ya tiene el máximo de 50 contactos' },
        { status: 422 },
      )
    }
    contactCount += 1
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
    current.contacts = [...current.contacts, contact]
    clients.set(id, current)
    return HttpResponse.json(contact, { status: 201 })
  }),

  http.delete('*/clients/:id/contacts/:contactId', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) === 'cobrador') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    contactWrites.push({ method: request.method, url: request.url, body: null })
    const clientId = String(params.id)
    const contactId = String(params.contactId)
    const current = clients.get(clientId)
    if (current) {
      current.contacts = current.contacts.map((item) =>
        item.id === contactId ? { ...item, is_active: false } : item,
      )
      clients.set(clientId, current)
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch('*/clients/:id/contacts/:contactId', async ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) === 'cobrador') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const payload = (await request.json()) as ContactUpdate
    contactWrites.push({ method: request.method, url: request.url, body: payload })
    const clientId = String(params.id)
    const contactId = String(params.contactId)
    const current = clients.get(clientId) ?? clientFixture({ id: clientId })
    const index = current.contacts.findIndex((item) => item.id === contactId)
    if (index < 0) {
      return HttpResponse.json({ detail: 'recurso no encontrado' }, { status: 404 })
    }
    const previous = current.contacts[index]
    const updated = {
      ...previous,
      name: payload.name ?? previous.name,
      phone: payload.phone ?? previous.phone,
      relationship: payload.relationship ?? previous.relationship,
      address: payload.address === undefined ? previous.address : payload.address,
      doc_type: payload.doc_type === undefined ? previous.doc_type : payload.doc_type,
      document: payload.document === undefined ? previous.document : payload.document,
      has_document: payload.document === undefined ? previous.has_document : Boolean(payload.document),
    }
    current.contacts = current.contacts.map((item, i) => (i === index ? updated : item))
    clients.set(clientId, current)
    return HttpResponse.json(updated)
  }),

  http.get('*/clients/:id', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const id = String(params.id)
    clientDetailRequests.push({ id, token: bearer(request) ?? '' })
    if (id === 'cli-missing') {
      return HttpResponse.json({ detail: 'recurso no encontrado' }, { status: 404 })
    }
    if (id === 'cli-blocked') {
      return HttpResponse.json(
        clientFixture({
          id,
          name: 'Luis Bloqueado',
          document: '001-8888888-8',
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
    const payload = (await request.json()) as ClientUpdate & { status?: string }
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
    clientWrites.push({ method: request.method, url: request.url, body: payload })
    const current = clients.get(id) ?? clientFixture({ id })
    const saved: ClientDetail = {
      ...current,
      name: payload.name ?? current.name,
      doc_type: payload.doc_type ?? current.doc_type,
      document: payload.document ?? current.document,
      phone: payload.phone ?? current.phone,
      address: payload.address ?? current.address,
      notes: payload.notes === undefined ? current.notes : payload.notes,
      collector_membership_id:
        payload.collector_membership_id === undefined
          ? current.collector_membership_id
          : payload.collector_membership_id,
    }
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

  http.get('*/audit', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'dueño') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    auditRequests.push({ method: request.method, url: request.url })
    const url = new URL(request.url)
    const entity = url.searchParams.get('entity')
    const userId = url.searchParams.get('user_id')
    const since = url.searchParams.get('from')
    const until = url.searchParams.get('to')
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('page_size') ?? 20)
    const items = buildAuditEvents().filter((item) => {
      if (entity && item.entity !== entity) return false
      if (userId && item.user_id !== userId && item.membership_id !== userId) return false
      if (since && item.created_at < since) return false
      if (until && item.created_at > until) return false
      return true
    })
    const start = (page - 1) * pageSize
    return HttpResponse.json({
      items: items.slice(start, start + pageSize),
      total: items.length,
      page,
      page_size: pageSize,
    })
  }),

  http.get('*/users', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'dueño') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    return HttpResponse.json(membersState)
  }),

  http.patch('*/users/:id', async ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) !== 'dueño') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const payload = (await request.json()) as MemberUpdate & { name?: unknown }
    memberWrites.push({ method: request.method, url: request.url, body: payload })
    if ('name' in payload) {
      return HttpResponse.json(
        {
          detail: [
            { loc: ['body', 'name'], msg: 'Extra inputs are not permitted', type: 'extra_forbidden' },
          ],
        },
        { status: 422 },
      )
    }
    const id = String(params.id)
    const index = membersState.findIndex((item) => item.id === id)
    if (index < 0) {
      return HttpResponse.json({ detail: 'recurso no encontrado' }, { status: 404 })
    }
    const current = membersState[index]
    const nextRole = payload.role ?? current.role
    const nextActive = payload.is_active ?? current.is_active
    const wouldDropLastOwner =
      current.role === 'dueño' &&
      current.is_active &&
      (nextRole !== 'dueño' || !nextActive) &&
      membersState.filter((item) => item.role === 'dueño' && item.is_active && item.id !== id)
        .length === 0
    if (wouldDropLastOwner) {
      return HttpResponse.json(
        { detail: 'el negocio debe tener al menos un dueño activo' },
        { status: 409 },
      )
    }
    const updated: MemberRead = {
      ...current,
      role: nextRole,
      is_active: nextActive,
    }
    membersState = membersState.map((item, i) => (i === index ? updated : item))
    return HttpResponse.json(updated)
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

  http.get('*/businesses/:id/credit-settings', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    return HttpResponse.json({
      interest_method: 'recargo_fijo',
      surcharge_mode: 'percent',
      surcharge_percent: '20.00',
      surcharge_amount: null,
      allowed_frequencies: ['semanal', 'quincenal', 'mensual'],
      max_installments: 24,
      min_down_payment_percent: '10.00',
    })
  }),

  http.post('*/sales/simulate', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) === 'cobrador') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const body = (await request.json()) as {
      client_id?: string
      price?: string
      down_payment?: string
      installments?: number
      frequency?: string
      first_due_date?: string
    }
    if (body.client_id === 'cli-blocked') {
      return HttpResponse.json(
        {
          detail: [
            {
              field: null,
              code: 'CLIENT_BLOCKED',
              message: 'Este cliente está bloqueado: Atraso de 3 cuotas',
            },
          ],
        },
        { status: 409 },
      )
    }
    if (body.down_payment && body.price && body.down_payment === body.price) {
      return HttpResponse.json(
        {
          detail: [
            {
              field: 'down_payment',
              code: 'DOWN_PAYMENT_INVALID',
              message: 'La inicial debe ser menor que el precio.',
            },
          ],
        },
        { status: 422 },
      )
    }
    const { buildPlan } = await import('./sales-msw')
    const n = body.installments ?? 12
    const frequency = (body.frequency ?? 'mensual') as 'semanal' | 'quincenal' | 'mensual'
    const plan = buildPlan({
      price: body.price ?? '0.00',
      down: body.down_payment ?? '0.00',
      n,
      frequency,
      firstDue: body.first_due_date,
      percent: '20.00',
    })
    const warnings: Array<{ code: string; message: string }> = []
    if (body.client_id === 'cli-collector-off') {
      warnings.push({
        code: 'collector_inactive',
        message:
          'El cobrador asignado al cliente está inactivo; reasígnale un cobrador activo para que pueda cobrar esta venta.',
      })
    }
    const { simulateResponse } = await import('./sales-msw')
    return HttpResponse.json(simulateResponse(plan, { warnings }))
  }),

  http.post('*/sales', async ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) === 'cobrador') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const body = (await request.json()) as Record<string, unknown>
    saleWrites.push({
      method: request.method,
      url: request.url,
      body,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    })
    if (body.client_id === 'cli-blocked') {
      return HttpResponse.json(
        {
          detail: [
            {
              field: null,
              code: 'CLIENT_BLOCKED',
              message: 'Este cliente está bloqueado: Atraso de 3 cuotas',
            },
          ],
        },
        { status: 409 },
      )
    }
    saleCount += 1
    const { buildPlan } = await import('./sales-msw')
    const n = typeof body.installments === 'number' ? body.installments : 12
    const frequency = (typeof body.frequency === 'string' ? body.frequency : 'mensual') as
      | 'semanal'
      | 'quincenal'
      | 'mensual'
    const firstDue = typeof body.first_due_date === 'string' ? body.first_due_date : undefined
    const anchor = typeof body.anchor_date === 'string' ? body.anchor_date : firstDue
    const plan = buildPlan({
      price: typeof body.price === 'string' ? body.price : '0.00',
      down: typeof body.down_payment === 'string' ? body.down_payment : '0.00',
      n,
      frequency,
      firstDue: anchor,
      percent: '20.00',
    })
    const { saleDetailFromPlan } = await import('./sales-msw')
    const clientId = String(body.client_id ?? 'cli-1')
    const sale = saleDetailFromPlan(plan, {
      id: `sale-${saleCount}`,
      sale_number: 100 + saleCount,
      client_id: clientId,
      client_name: clients.get(clientId)?.name ?? 'Ana Pérez',
      item_description: String(body.item_description ?? ''),
      price: typeof body.price === 'string' ? body.price : '0.00',
      down_payment: typeof body.down_payment === 'string' ? body.down_payment : '0.00',
      frequency,
      anchor_date: typeof body.anchor_date === 'string' ? body.anchor_date : plan.first,
      anchor_offset: typeof body.anchor_offset === 'number' ? body.anchor_offset : 0,
    })
    sales.set(sale.id, sale)
    return HttpResponse.json(sale, { status: 201 })
  }),

  http.get('*/sales/:id/contract.pdf', ({ request, params }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    if (roleFromToken(bearer(request)) === 'cobrador') {
      return HttpResponse.json({ detail: 'no autorizado' }, { status: 403 })
    }
    const id = String(params.id)
    if (!sales.has(id) && id !== 'sale-1') {
      return HttpResponse.json({ detail: 'recurso no encontrado' }, { status: 404 })
    }
    return new HttpResponse(new Blob(['%PDF-1.4 mock'], { type: 'application/pdf' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="contrato-venta-${id}.pdf"`,
      },
    })
  }),

  http.get('*/sales', ({ request }) => {
    const denied = requireAuth(request)
    if (denied) return denied
    const items = [...sales.values()].map((sale) => {
      const read = { ...sale }
      delete read.installments
      delete read.contract
      delete read.warnings
      return read
    })
    return HttpResponse.json({
      items,
      total: items.length,
      page: 1,
      page_size: 50,
    })
  }),
]
