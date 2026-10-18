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
export const PENDING_SALE_PREFIX = 'cobrafy.pendingSale:'

export type PendingSaleAttempt = {
  key: string
  payload: SaleCreateRequest
  snapshot: SaleFormSnapshot
}

export function pendingSaleStorageKey(clientId: string): string {
  return `${PENDING_SALE_PREFIX}${clientId}`
}

/** 422 or a 409 with a business code (including REUSED) prove the original sale did not land. */
export function shouldReleasePendingSale(status: number, code?: string): boolean {
  if (status === 422) return true
  return status === 409 && Boolean(code)
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
  return isAttempt(stored) ? stored : null
}

export function writePendingSale(clientId: string, attempt: PendingSaleAttempt) {
  writeJson(pendingSaleStorageKey(clientId), attempt)
}

export function clearPendingSale(clientId: string) {
  removeKey(pendingSaleStorageKey(clientId))
}
