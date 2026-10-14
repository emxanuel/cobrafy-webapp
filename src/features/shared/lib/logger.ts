/**
 * Logs de la app: solo método, ruta y código. Nunca cuerpo, tokens, correo,
 * documentos ni nombres.
 */
export function logHttpError(meta: {
  method?: string
  path?: string
  status?: number
}) {
  if (import.meta.env.MODE === 'test') return
  console.error('Error de red', {
    method: meta.method,
    path: redactPath(meta.path),
    status: meta.status,
  })
}

export function redactPath(path: string | undefined): string | undefined {
  if (!path) return path
  return path
    .replace(/[?#].*$/, '')
    .replace(/\/invitar\/[^/]+/gi, '/invitar/:token')
    .replace(/([?&]token=)[^&]*/gi, '$1:token')
}
