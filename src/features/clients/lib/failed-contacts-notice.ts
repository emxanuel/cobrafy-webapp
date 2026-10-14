import { FAILED_CONTACTS_KEY } from '@/features/shared/lib/session-storage'

export type FailedContactOp = 'add' | 'edit' | 'remove'

export type FailedContact = {
  name: string
  op: FailedContactOp
}

export type ContactsSaveNotice = {
  failed: FailedContact[]
  applied: FailedContact[]
  stoppedOnUnauthorized: boolean
}

function who(item: FailedContact) {
  return item.name.trim() || 'contacto'
}

function failedPhrase(item: FailedContact) {
  if (item.op === 'remove') return `No se pudo quitar a ${who(item)}`
  if (item.op === 'edit') return `No se pudo guardar el cambio de ${who(item)}`
  return `No se pudo agregar a ${who(item)}`
}

function appliedPhrase(item: FailedContact) {
  if (item.op === 'remove') return `Se quitó a ${who(item)}`
  if (item.op === 'edit') return `Se guardó el cambio de ${who(item)}`
  return `Se agregó a ${who(item)}`
}

export function failedContactsNotice(
  failed: FailedContact[],
  extras?: { applied?: FailedContact[]; stoppedOnUnauthorized?: boolean },
): string {
  const applied = extras?.applied ?? []
  const stopped = extras?.stoppedOnUnauthorized ?? false
  if (failed.length === 0 && !stopped) return ''
  const parts: string[] = []
  if (stopped && applied.length > 0) {
    parts.push(`${applied.map(appliedPhrase).join('. ')}.`)
  }
  if (failed.length > 0) {
    parts.push(failed.map((item) => `${failedPhrase(item)}.`).join(' '))
  }
  if (stopped) {
    parts.push('Tu sesión caducó. Entra de nuevo para terminar.')
  } else {
    parts.push('Revísalo aquí.')
  }
  return parts.join(' ')
}

function asFailedContact(item: unknown): FailedContact | null {
  if (!item || typeof item !== 'object') return null
  const row = item as { name?: unknown; op?: unknown }
  if (typeof row.name !== 'string') return null
  if (row.op !== 'add' && row.op !== 'edit' && row.op !== 'remove') return null
  return { name: row.name, op: row.op }
}

export function emptyContactsSaveNotice(): ContactsSaveNotice {
  return { failed: [], applied: [], stoppedOnUnauthorized: false }
}

export function parseContactsSaveNotice(raw: string | null): ContactsSaveNotice {
  if (!raw) return emptyContactsSaveNotice()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return {
        failed: parsed.flatMap((item) => {
          const row = asFailedContact(item)
          return row ? [row] : []
        }),
        applied: [],
        stoppedOnUnauthorized: false,
      }
    }
    if (!parsed || typeof parsed !== 'object') return emptyContactsSaveNotice()
    const row = parsed as {
      failed?: unknown
      applied?: unknown
      stoppedOnUnauthorized?: unknown
    }
    const failed = Array.isArray(row.failed)
      ? row.failed.flatMap((item) => {
          const contact = asFailedContact(item)
          return contact ? [contact] : []
        })
      : []
    const applied = Array.isArray(row.applied)
      ? row.applied.flatMap((item) => {
          const contact = asFailedContact(item)
          return contact ? [contact] : []
        })
      : []
    return {
      failed,
      applied,
      stoppedOnUnauthorized: row.stoppedOnUnauthorized === true,
    }
  } catch {
    return emptyContactsSaveNotice()
  }
}

export function parseFailedContacts(raw: string | null): FailedContact[] {
  return parseContactsSaveNotice(raw).failed
}

export function persistContactsSaveNotice(notice: ContactsSaveNotice) {
  if (notice.failed.length === 0 && !notice.stoppedOnUnauthorized) {
    sessionStorage.removeItem(FAILED_CONTACTS_KEY)
    return
  }
  sessionStorage.setItem(FAILED_CONTACTS_KEY, JSON.stringify(notice))
}
