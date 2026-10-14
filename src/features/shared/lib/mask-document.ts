/** Last 4 digits stay visible; other characters become • except dashes. */
export function maskDocument(doc: string): string {
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

export function normalizeDocumentInput(value: string): string {
  return value.replace(/[\s-]/g, '')
}

export function isAlreadyMaskedDocument(doc: string): boolean {
  return /[•*]/.test(doc)
}
