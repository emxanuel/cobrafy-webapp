/**
 * La sesión vive en sessionStorage, no en localStorage.
 *
 * Por qué no memoria sola: en el celular un refresco accidental (gesto, teclado
 * o cambio de pestaña) no debe pedir el correo otra vez a mitad de un alta.
 *
 * Por qué no localStorage: el token quedaría en el disco después de cerrar el
 * navegador. sessionStorage se borra al cerrar la pestaña.
 */
export const SESSION_KEY = 'cobrafy.session'
export const BUSINESS_KEY = 'cobrafy.business'
export const LOGIN_NOTICE_KEY = 'cobrafy.loginNotice'

export function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown) {
  sessionStorage.setItem(key, JSON.stringify(value))
}

export function removeKey(key: string) {
  sessionStorage.removeItem(key)
}
