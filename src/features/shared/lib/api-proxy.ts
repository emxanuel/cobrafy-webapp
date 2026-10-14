export const API_PROXY_PREFIXES = [
  'auth',
  'clients',
  'users',
  'invitations',
  'audit',
] as const

export function apiProxyPattern(prefix: string): string {
  return `^/${prefix}(\\?|/|$)`
}

export function matchesApiProxy(pathname: string, prefix: string): boolean {
  return new RegExp(apiProxyPattern(prefix)).test(pathname)
}

export function apiProxyConfig(target: string): Record<string, { target: string; changeOrigin: true }> {
  return Object.fromEntries(
    API_PROXY_PREFIXES.map((prefix) => [
      apiProxyPattern(prefix),
      { target, changeOrigin: true as const },
    ]),
  )
}
