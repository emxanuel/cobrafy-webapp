import { describe, expect, it } from 'vitest'

import {
  isAlreadyMaskedDocument,
  maskDocument,
  normalizeDocumentInput,
} from './mask-document'

describe('maskDocument', () => {
  it('enmascara una cédula y conserva los guiones', () => {
    expect(maskDocument('001-1234567-8')).toBe('•••-••••567-8')
  })

  it('enmascara un pasaporte dejando los últimos 4 dígitos', () => {
    expect(maskDocument('AB1234567')).toBe('•••••4567')
  })

  it('no destapa un documento que el backend ya enmascaró', () => {
    expect(maskDocument('•••-••••567-8')).toBe('•••-••••567-8')
  })

  it('normaliza quitando guiones y espacios', () => {
    expect(normalizeDocumentInput('001-1234567-8')).toBe('00112345678')
    expect(normalizeDocumentInput('001 123 4567 8')).toBe('00112345678')
  })

  it('detecta documentos ya enmascarados', () => {
    expect(isAlreadyMaskedDocument('001-*****1234')).toBe(true)
    expect(isAlreadyMaskedDocument('001-1234567-8')).toBe(false)
  })
})
