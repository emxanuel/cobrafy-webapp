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
  const path = sanitizePath(meta.path)
  console.error('Error de red', {
    method: meta.method,
    path,
    status: meta.status,
  })
}

function sanitizePath(path: string | undefined): string | undefined {
  if (!path) return path
  return path.replace(/[?#].*$/, '')
}
