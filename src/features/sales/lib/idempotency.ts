import { readJson, removeKey, writeJson } from '@/features/shared/lib/session-storage'

export type IdempotencyState = {
  fingerprint: string
  key: string
}

export const IDEMPOTENCY_STORAGE_PREFIX = 'cobrafy.saleIdempotency:'

export function idempotencyStorageKey(fingerprint: string): string {
  return `${IDEMPOTENCY_STORAGE_PREFIX}${fingerprint}`
}

export function readIdempotencyKey(fingerprint: string): string | null {
  const stored = readJson<{ key?: unknown }>(idempotencyStorageKey(fingerprint))
  return typeof stored?.key === 'string' && stored.key.length > 0 ? stored.key : null
}

export function writeIdempotencyKey(fingerprint: string, key: string) {
  writeJson(idempotencyStorageKey(fingerprint), { key })
}

export function clearIdempotencyKey(fingerprint: string) {
  removeKey(idempotencyStorageKey(fingerprint))
}

/** Reuse the key for the same body; mint a new UUID only when the payload changed. */
export function idempotencyForForm(
  current: IdempotencyState | null,
  fingerprint: string,
  randomUUID: () => string = () => crypto.randomUUID(),
): IdempotencyState {
  if (current?.fingerprint === fingerprint) {
    writeIdempotencyKey(fingerprint, current.key)
    return current
  }
  const stored = readIdempotencyKey(fingerprint)
  if (stored) return { fingerprint, key: stored }
  const next = { fingerprint, key: randomUUID() }
  writeIdempotencyKey(fingerprint, next.key)
  return next
}
