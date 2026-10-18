import { readJson, removeKey, writeJson } from '@/features/shared/lib/session-storage'
import type { SaleCreateRequest } from '@/features/sales/services/types'
import type { SaleFormSnapshot } from '@/features/sales/lib/sale-payload'

export const PENDING_SALE_TITLE = 'Venta por confirmar'
export const PENDING_SALE_BODY =
  'No pudimos confirmar si la venta se registró. Reintenta; no se duplicará.'
export const PENDING_SALE_STILL_OFFLINE =
  'Todavía sin conexión. Prueba de nuevo en un momento.'
export const PENDING_SALE_UNCONFIRMED =
  'No pudimos confirmar la venta. Reintenta o revisa las compras del cliente.'
export const PENDING_SALE_FAILED =
  'La venta no se registró. Revisa los datos y confirma de nuevo.'
export const PENDING_SALE_EXPIRED_TITLE = 'Ya no se puede reintentar'
export const PENDING_SALE_EXPIRED_BODY =
  'Pasó mucho tiempo y no sabemos si la venta se registró. Revisa las compras del cliente antes de registrarla de nuevo.'
export const DISCARD_SALE_LABEL = 'Descartar'
export const DISCARD_SALE_TITLE = '¿Descartar esta venta?'
export const DISCARD_SALE_BODY =
  'Si ya se registró, la verás en las compras del cliente. Si no, tendrás que registrarla de nuevo.'
export const DISCARD_SALE_BACK = 'Volver'
export const DISCARD_SALE_TOAST = 'Venta descartada.'
export const PENDING_SALE_PREFIX = 'cobrafy.pendingSale:'
export const PENDING_SALE_TTL_MS = 23 * 60 * 60 * 1000

export type PendingSaleAttempt = {
  key: string
  payload: SaleCreateRequest
  snapshot: SaleFormSnapshot
  created_at: string
}

export function pendingSaleStorageKey(clientId: string): string {
  return `${PENDING_SALE_PREFIX}${clientId}`
}

/** 422 or a 409 with a business code (including REUSED) prove the original sale did not land. */
export function shouldReleasePendingSale(status: number, code?: string): boolean {
  if (status === 422) return true
  return status === 409 && Boolean(code)
}

export function isPendingSaleExpired(
  attempt: Pick<PendingSaleAttempt, 'created_at'>,
  now = Date.now(),
): boolean {
  const created = Date.parse(attempt.created_at)
  if (!Number.isFinite(created)) return true
  return now - created >= PENDING_SALE_TTL_MS
}

export function clearAllPendingSales() {
  const keys: string[] = []
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith(PENDING_SALE_PREFIX)) keys.push(key)
  }
  for (const key of keys) sessionStorage.removeItem(key)
}

function isAttempt(value: unknown): value is PendingSaleAttempt {
  if (typeof value !== 'object' || value == null) return false
  const row = value as PendingSaleAttempt
  return (
    typeof row.key === 'string' &&
    row.key.length > 0 &&
    typeof row.payload === 'object' &&
    row.payload != null &&
    typeof row.snapshot === 'object' &&
    row.snapshot != null
  )
}

export function readPendingSale(clientId: string): PendingSaleAttempt | null {
  const stored = readJson<PendingSaleAttempt>(pendingSaleStorageKey(clientId))
  if (!isAttempt(stored)) return null
  return {
    ...stored,
    created_at: typeof stored.created_at === 'string' ? stored.created_at : '',
  }
}

export function writePendingSale(
  clientId: string,
  attempt: Omit<PendingSaleAttempt, 'created_at'> & { created_at?: string },
) {
  writeJson(pendingSaleStorageKey(clientId), {
    ...attempt,
    created_at: attempt.created_at || new Date().toISOString(),
  })
}

export function clearPendingSale(clientId: string) {
  removeKey(pendingSaleStorageKey(clientId))
}
