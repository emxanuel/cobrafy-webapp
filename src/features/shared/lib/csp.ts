const BASE_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
] as const

const TAIL_DIRECTIVES = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
] as const

export class InvalidApiBaseUrlError extends Error {
  constructor(value: string) {
    super(
      `VITE_API_BASE_URL inválida: "${value}". Usa una URL http(s) absoluta o una ruta que empiece con /.`,
    )
    this.name = 'InvalidApiBaseUrlError'
  }
}

export function resolveApiOrigin(apiBaseUrl: string | undefined): string | null {
  const raw = apiBaseUrl?.trim() ?? ''
  if (!raw || raw.startsWith('/')) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

export function assertApiBaseUrl(apiBaseUrl: string | undefined): void {
  const raw = apiBaseUrl?.trim() ?? ''
  if (!raw || raw.startsWith('/')) return
  if (!resolveApiOrigin(raw)) throw new InvalidApiBaseUrlError(raw)
}

export function buildContentSecurityPolicy(options: {
  apiBaseUrl?: string
  production?: boolean
}): string {
  assertApiBaseUrl(options.apiBaseUrl)
  const origin = resolveApiOrigin(options.apiBaseUrl)
  const connectSrc = origin ? `'self' ${origin}` : "'self'"
  const directives: string[] = [
    ...BASE_DIRECTIVES,
    `connect-src ${connectSrc}`,
    ...TAIL_DIRECTIVES,
  ]
  const apiIsHttp = origin?.startsWith('http:') ?? false
  if (options.production && !apiIsHttp) {
    directives.push('upgrade-insecure-requests')
  }
  return directives.join('; ')
}
