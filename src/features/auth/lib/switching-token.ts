let switchingFromToken: string | null = null

export function getSwitchingFromToken(): string | null {
  return switchingFromToken
}

export function setSwitchingFromToken(token: string | null): void {
  switchingFromToken = token
}
