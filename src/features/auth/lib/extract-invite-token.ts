/** Extrae el token de un código suelto o de un enlace `/invitar/:token`. */
export function extractInviteToken(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const fromPath = (pathname: string) => {
    const match = pathname.match(/\/invitar\/([^/]+)/i)
    if (!match?.[1]) return ''
    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }

  try {
    const url = new URL(trimmed)
    const pathToken = fromPath(url.pathname)
    if (pathToken) return pathToken
    const queryToken = url.searchParams.get('token')?.trim()
    if (queryToken) return queryToken
  } catch {
    // no es una URL absoluta
  }

  const relative = trimmed.match(/(?:^|\/)invitar\/([^/?#]+)/i)
  if (relative?.[1]) {
    try {
      return decodeURIComponent(relative[1])
    } catch {
      return relative[1]
    }
  }

  if (!trimmed.includes('://') && !trimmed.includes('/')) return trimmed
  return fromPath(trimmed.startsWith('/') ? trimmed : `/${trimmed}`) || trimmed
}
