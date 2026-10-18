/** Turns typed money (`18500`, `18,500`, `18500.5`) into a decimal string. No Number. */
export function parseMoneyInput(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s/g, '')
  if (!trimmed) return null
  const normalized = trimmed.replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const [intPart, frac = ''] = normalized.split('.')
  const whole = (intPart || '0').replace(/^0+(?=\d)/, '') || '0'
  const cents = `${frac}00`.slice(0, 2)
  return `${whole}.${cents}`
}

export function isPositiveAmount(raw: string): boolean {
  const amount = parseMoneyInput(raw)
  if (!amount) return false
  return /[1-9]/.test(amount)
}

/** `18500.00` → `18,500.00` for the input, still a string. */
export function formatAmountInput(amount: string): string {
  const parsed = parseMoneyInput(amount)
  if (!parsed) return amount
  const [intPart, frac] = parsed.split('.')
  const grouped = (intPart ?? '0').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
  return `${grouped}.${frac}`
}
