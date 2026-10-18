export type IdempotencyState = {
  fingerprint: string
  key: string
}

/** Reuse the key for the same form; mint a new UUID only when the form changed. */
export function idempotencyForForm(
  current: IdempotencyState | null,
  fingerprint: string,
  randomUUID: () => string = () => crypto.randomUUID(),
): IdempotencyState {
  if (current?.fingerprint === fingerprint) return current
  return { fingerprint, key: randomUUID() }
}
