const ALLOWED = [
  /^\/clientes(\/.*)?$/,
  /^\/equipo$/,
  /^\/clave-rapida$/,
  /^\/negocios$/,
  /^\/desbloquear$/,
]

export function safeInternalPath(from: unknown): string | undefined {
  if (typeof from !== 'string') return undefined
  if (!from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) {
    return undefined
  }
  if (from.includes('://') || from.includes('\\')) return undefined
  const path = from.replace(/[?#].*$/, '')
  if (path === '/login' || path.startsWith('/invitar')) return undefined
  if (!ALLOWED.some((pattern) => pattern.test(path))) return undefined
  return path
}
