const ALLOWED = [
  /^\/clientes(\/.*)?$/,
  /^\/equipo$/,
  /^\/clave-rapida$/,
  /^\/negocios$/,
  /^\/negocio$/,
  /^\/ventas(\/.*)?$/,
  /^\/desbloquear$/,
]

function containsControlChars(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

export function safeInternalPath(from: unknown): string | undefined {
  if (typeof from !== 'string') return undefined
  if (containsControlChars(from)) return undefined

  let decoded: string
  try {
    decoded = decodeURIComponent(from)
  } catch {
    return undefined
  }
  if (containsControlChars(decoded)) return undefined
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return undefined
  }
  if (decoded.includes('://') || decoded.includes('\\')) return undefined
  const path = decoded.replace(/[?#].*$/, '')
  if (path === '/login' || path.startsWith('/invitar')) return undefined
  if (!ALLOWED.some((pattern) => pattern.test(path))) return undefined
  return path
}
