import { describe, expect, it } from 'vitest'

import { getFieldErrors, isApiError } from '@/features/shared/lib/api-error'

import { acceptInvitation } from './requests'

describe('acceptInvitation', () => {
  it('si falta el nombre manda field null', async () => {
    try {
      await acceptInvitation({ token: 'inv-ok', password: 'clavesegura' })
      throw new Error('debía fallar')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(getFieldErrors(error)).toEqual({})
      expect((error as Error).message).toBe('El nombre es obligatorio')
    }
  })

  it('si falta la contraseña manda field null', async () => {
    try {
      await acceptInvitation({ token: 'inv-ok', name: 'Nora Nueva' })
      throw new Error('debía fallar')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(getFieldErrors(error)).toEqual({})
      expect((error as Error).message).toBe('La contraseña es obligatoria')
    }
  })

  it('un nombre vacío o con espacios manda field name', async () => {
    try {
      await acceptInvitation({ token: 'inv-ok', name: '   ', password: 'clavesegura' })
      throw new Error('debía fallar')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(getFieldErrors(error).name).toBe('El nombre es obligatorio')
      expect((error as Error).message).toBe('El nombre es obligatorio')
    }
  })
})
