const CEDULA_IN_TEXT = /\b\d{3}-?\d{7}-?\d\b/g

/** Last 4 digits stay visible; other characters become • except dashes. */
export function maskDocument(doc: string): string {
  if (!doc) return doc
  const chars = [...doc]
  const digitIndexes = chars.flatMap((ch, index) => (/\d/.test(ch) ? [index] : []))
  const keep = new Set(digitIndexes.slice(-4))
  return chars
    .map((ch, index) => {
      if (ch === '-') return ch
      if (/\d/.test(ch)) return keep.has(index) ? ch : '•'
      return '•'
    })
    .join('')
}

export function maskDocumentsInText(text: string): string {
  return text.replace(CEDULA_IN_TEXT, (match) => maskDocument(match))
}

export function normalizeDocumentInput(value: string): string {
  return value.replace(/[\s-]/g, '')
}

export function isAlreadyMaskedDocument(doc: string): boolean {
  return /[•*]/.test(doc)
}
