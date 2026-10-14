import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'

import { useAuditQuery } from '@/features/audit/hooks/use-audit-queries'
import {
  auditActionTitle,
  changedFields,
  dateToAwareEnd,
  dateToAwareStart,
  ENTITY_OPTIONS,
  entityBadgeLabel,
  fieldLabel,
  formatAuditValue,
} from '@/features/audit/lib/labels'
import { AUDIT_PAGE_SIZE, type AuditFilters, type AuditRead } from '@/features/audit/services/types'
import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { useMembersQuery } from '@/features/members/hooks/use-members-queries'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { Badge } from '@/features/shared/components/ui/badge'
import { Button } from '@/features/shared/components/ui/button'
import { EmptyState } from '@/features/shared/components/ui/empty-state'
import { Field, SelectInput, TextInput } from '@/features/shared/components/ui/field'
import { Skeleton } from '@/features/shared/components/ui/skeleton'
import { formatDateTime } from '@/features/shared/lib/format-date'
import { getApiErrorMessage, isApiError } from '@/features/shared/lib/api-error'
import { canViewAudit, ROLE_LABEL } from '@/features/shared/lib/roles'
import { AuditUnauthorized } from '@/pages/audit/audit-unauthorized'

function readFilters(params: URLSearchParams): {
  entity: string
  actor: string
  from: string
  to: string
  page: number
} {
  const page = Number(params.get('page') ?? '1')
  return {
    entity: params.get('entity') ?? '',
    actor: params.get('actor') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  }
}

function countActiveFilters(filters: { entity: string; actor: string; from: string; to: string }) {
  return [filters.entity, filters.actor, filters.from, filters.to].filter(Boolean).length
}

export function AuditPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const applied = readFilters(searchParams)
  const activeCount = countActiveFilters(applied)
  const [entity, setEntity] = useState(applied.entity)
  const [actor, setActor] = useState(applied.actor)
  const [from, setFrom] = useState(applied.from)
  const [to, setTo] = useState(applied.to)
  const [draftRangeError, setDraftRangeError] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(activeCount > 0)
  const listRef = useRef<HTMLOListElement>(null)
  const invalidRange = Boolean(applied.from && applied.to && applied.from > applied.to)
  const rangeError = invalidRange
    ? 'La fecha final debe ser igual o posterior a la inicial.'
    : draftRangeError

  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null
  const allowed = canViewAudit(role)
  const members = useMembersQuery(allowed)

  const queryFilters = useMemo<AuditFilters>(() => {
    const filters: AuditFilters = {}
    if (applied.entity) filters.entity = applied.entity
    if (applied.actor) filters.user_id = applied.actor
    if (!invalidRange && applied.from) filters.from = dateToAwareStart(applied.from)
    if (!invalidRange && applied.to) filters.to = dateToAwareEnd(applied.to)
    return filters
  }, [applied.entity, applied.actor, applied.from, applied.to, invalidRange])

  const audit = useAuditQuery(queryFilters, applied.page, allowed && !invalidRange)
  const namesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of members.data ?? []) {
      map.set(member.id, member.name)
      if (member.user_id) map.set(member.user_id, member.name)
    }
    return map
  }, [members.data])
  const roleByMembership = useMemo(() => {
    const map = new Map<string, (typeof ROLE_LABEL)[keyof typeof ROLE_LABEL]>()
    for (const member of members.data ?? []) {
      map.set(member.id, ROLE_LABEL[member.role])
    }
    return map
  }, [members.data])

  if (!allowed || (isApiError(audit.error) && audit.error.status === 403)) {
    return <AuditUnauthorized />
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    if (from && to && from > to) {
      setDraftRangeError('La fecha final debe ser igual o posterior a la inicial.')
      return
    }
    setDraftRangeError('')
    const next = new URLSearchParams()
    if (entity) next.set('entity', entity)
    if (actor) next.set('actor', actor)
    if (from) next.set('from', from)
    if (to) next.set('to', to)
    next.set('page', '1')
    setSearchParams(next)
  }

  function clearFilters() {
    setEntity('')
    setActor('')
    setFrom('')
    setTo('')
    setDraftRangeError('')
    setSearchParams(new URLSearchParams())
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
    listRef.current?.scrollIntoView?.({ block: 'start' })
  }

  const items = audit.data?.items ?? []
  const total = audit.data?.total ?? 0
  const pageSize = audit.data?.page_size ?? AUDIT_PAGE_SIZE
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (applied.page - 1) * pageSize + 1
  const end = Math.min(applied.page * pageSize, total)
  const hasNext = applied.page * pageSize < total
  const pageOutOfRange =
    !invalidRange &&
    !audit.isLoading &&
    !audit.isError &&
    Boolean(audit.data) &&
    total > 0 &&
    applied.page > lastPage
  const showEmpty =
    !invalidRange &&
    !audit.isLoading &&
    !audit.isError &&
    items.length === 0 &&
    !pageOutOfRange

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Bitácora"
        description="Quién cambió qué y cuándo en tu negocio."
      />

      <details
        className="border-border rounded-md border"
        open={filtersOpen}
        onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
      >
        <summary className="text-heading flex min-h-11 cursor-pointer items-center justify-between px-4 font-medium">
          Filtros
          {activeCount > 0 ? (
            <Badge tone="accent">{activeCount} activos</Badge>
          ) : null}
        </summary>
        <form className="flex flex-col gap-4 px-4 pb-4 md:grid md:grid-cols-4 md:items-end" onSubmit={applyFilters}>
          <Field id="audit-entity" label="Entidad">
            <SelectInput
              id="audit-entity"
              value={entity}
              onChange={(event) => setEntity(event.target.value)}
            >
              {ENTITY_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="audit-actor" label="Usuario">
            <SelectInput
              id="audit-actor"
              value={actor}
              onChange={(event) => setActor(event.target.value)}
            >
              <option value="">Todos</option>
              {(members.data ?? []).map((member) => (
                <option key={member.id} value={member.user_id ?? member.id}>
                  {member.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-2 gap-3 md:contents">
            <Field id="audit-from" label="Desde">
              <TextInput
                id="audit-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field
              id="audit-to"
              label="Hasta"
              error={rangeError}
            >
              <TextInput
                id="audit-to"
                type="date"
                value={to}
                error={rangeError}
                onChange={(event) => {
                  setTo(event.target.value)
                  setDraftRangeError('')
                }}
              />
            </Field>
          </div>
          <div className="flex gap-3 md:col-span-4">
            <Button type="submit" className="flex-1">
              Aplicar
            </Button>
            <Button variant="ghost" onClick={clearFilters}>
              Limpiar
            </Button>
          </div>
        </form>
      </details>

      {audit.isError ? (
        <>
          <Alert>
            {isApiError(audit.error) && audit.error.status === 422
              ? getApiErrorMessage(
                  audit.error,
                  'Revisa los filtros. Hay un dato que el servidor no acepta.',
                )
              : 'No se pudo cargar la bitácora. Revisa tu conexión e inténtalo de nuevo.'}
          </Alert>
          <Button variant="outline" onClick={() => void audit.refetch()}>
            Reintentar
          </Button>
        </>
      ) : null}

      {audit.isLoading && !audit.data ? (
        <ol aria-busy="true" className="m-0 flex list-none flex-col gap-3 p-0">
          <li className="sr-only">Cargando…</li>
          <AuditSkeleton />
          <AuditSkeleton />
          <AuditSkeleton />
        </ol>
      ) : null}

      {pageOutOfRange ? (
        <EmptyState
          title="página fuera de rango"
          action={
            <Button variant="outline" className="mt-3" onClick={() => goToPage(1)}>
              Ir a la página 1
            </Button>
          }
        >
          Esta página no tiene eventos. Vuelve a la primera.
        </EmptyState>
      ) : null}

      {showEmpty && !pageOutOfRange ? (
        activeCount > 0 ? (
          <EmptyState
            title="No hay eventos con estos filtros"
            action={
              <Button variant="outline" className="mt-3" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            }
          >
            Prueba con otro rango de fechas o quita filtros.
          </EmptyState>
        ) : (
          <EmptyState title="Todavía no hay eventos registrados." />
        )
      ) : null}

      {items.length > 0 ? (
        <>
          <p className="m-0 text-sm">
            Mostrando {start}–{end} de {total} eventos
          </p>
          <ol ref={listRef} className="m-0 flex list-none flex-col gap-3 p-0">
            {items.map((event) => (
              <AuditEventCard
                key={event.id}
                event={event}
                namesById={namesById}
                roleByMembership={roleByMembership}
              />
            ))}
          </ol>
          <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={applied.page <= 1}
              onClick={() => goToPage(applied.page - 1)}
            >
              ‹ Anterior
            </Button>
            <span className="text-sm">Página {applied.page} · {AUDIT_PAGE_SIZE} por página</span>
            <Button
              variant="outline"
              disabled={!hasNext}
              onClick={() => goToPage(applied.page + 1)}
            >
              Siguiente ›
            </Button>
          </nav>
        </>
      ) : null}
    </div>
  )
}

function AuditSkeleton() {
  return (
    <li className="border-border rounded-md border px-4 py-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </li>
  )
}

function actorMeta(
  event: AuditRead,
  namesById: Map<string, string>,
  roleByMembership: Map<string, string>,
): string {
  const name =
    (event.membership_id && namesById.get(event.membership_id)) ||
    (event.user_id && namesById.get(event.user_id)) ||
    'Alguien del negocio'
  const roleLabel = event.membership_id ? roleByMembership.get(event.membership_id) : undefined
  const who = roleLabel ? `${name} (${roleLabel})` : name
  return `${who} · ${formatDateTime(event.created_at)}`
}

function AuditEventCard({
  event,
  namesById,
  roleByMembership,
}: {
  event: AuditRead
  namesById: Map<string, string>
  roleByMembership: Map<string, string>
}) {
  const fields = changedFields(event)
  const creationOnly = event.before == null && event.after != null

  return (
    <li className="border-border rounded-md border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-heading m-0 font-medium">{auditActionTitle(event)}</p>
        <Badge>{entityBadgeLabel(event.entity)}</Badge>
      </div>
      <p className="m-0 text-sm">{actorMeta(event, namesById, roleByMembership)}</p>
      {fields.length > 0 ? (
        <details className="mt-2">
          <summary className="text-accent min-h-8 cursor-pointer text-sm">Ver cambios</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {creationOnly ? (
              <>
                <div className="grid grid-cols-[6rem_1fr] gap-2 text-xs uppercase">
                  <span>Campo</span>
                  <span>Valor</span>
                </div>
                {fields.map((field) => (
                  <div key={field} className="grid grid-cols-[6rem_1fr] gap-2 text-sm">
                    <span>{fieldLabel(field)}</span>
                    <span className="bg-success-bg text-success rounded px-1.5">
                      {formatAuditValue(field, event.after?.[field], namesById)}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="grid grid-cols-[6rem_1fr_1fr] gap-2 text-xs uppercase">
                  <span>Campo</span>
                  <span>Antes</span>
                  <span>Después</span>
                </div>
                {fields.map((field) => (
                  <div key={field} className="grid grid-cols-[6rem_1fr_1fr] gap-2 text-sm">
                    <span>{fieldLabel(field)}</span>
                    <span className="bg-danger-bg text-danger rounded px-1.5 line-through">
                      {formatAuditValue(field, event.before?.[field], namesById)}
                    </span>
                    <span className="bg-success-bg text-success rounded px-1.5">
                      {formatAuditValue(field, event.after?.[field], namesById)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </details>
      ) : null}
    </li>
  )
}
