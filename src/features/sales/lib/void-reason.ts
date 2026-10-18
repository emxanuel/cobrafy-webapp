export const VOID_REASON_MIN = 5
export const VOID_REASON_MAX = 500

export function trimmedReasonLength(value: string): number {
  return value.trim().length
}

export function isVoidReasonValid(value: string): boolean {
  const len = trimmedReasonLength(value)
  return len >= VOID_REASON_MIN && len <= VOID_REASON_MAX
}
