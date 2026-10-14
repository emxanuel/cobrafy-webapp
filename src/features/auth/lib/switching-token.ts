import { useSyncExternalStore } from 'react'

let switchingFromToken: string | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function getSwitchingFromToken(): string | null {
  return switchingFromToken
}

export function setSwitchingFromToken(token: string | null): void {
  if (switchingFromToken === token) return
  switchingFromToken = token
  emit()
}

export function subscribeSwitchingFromToken(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function useSwitchingFromToken() {
  return useSyncExternalStore(
    subscribeSwitchingFromToken,
    getSwitchingFromToken,
    getSwitchingFromToken,
  )
}
