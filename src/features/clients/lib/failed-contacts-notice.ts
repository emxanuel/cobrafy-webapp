export type FailedContactOp = 'add' | 'edit' | 'remove'

export type FailedContact = {
  name: string
  op: FailedContactOp
}

function who(item: FailedContact) {
  return item.name.trim() || 'contacto'
}

function phrase(item: FailedContact) {
  if (item.op === 'remove') return `No se pudo quitar a ${who(item)}`
  if (item.op === 'edit') return `No se pudo guardar el cambio de ${who(item)}`
  return `No se pudo agregar a ${who(item)}`
}

export function failedContactsNotice(failed: FailedContact[]): string {
  if (failed.length === 0) return ''
  const sentences = failed.map((item) => `${phrase(item)}.`)
  return `${sentences.join(' ')} Revísalo aquí.`
}

export function parseFailedContacts(raw: string | null): FailedContact[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as { name?: unknown; op?: unknown }
      if (typeof row.name !== 'string') return []
      if (row.op !== 'add' && row.op !== 'edit' && row.op !== 'remove') return []
      return [{ name: row.name, op: row.op }]
    })
  } catch {
    return []
  }
}
