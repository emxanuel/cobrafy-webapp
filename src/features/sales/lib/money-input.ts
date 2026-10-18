const GROUPED = /^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$/
const PLAIN = /^\d+(?:\.\d{1,2})?$/

/** Turns typed money into a decimal string. Anything outside the allowed formats is null. */
export function parseMoneyInput(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s/g, '')
  if (!trimmed) return null
  if (!GROUPED.test(trimmed) && !PLAIN.test(trimmed)) return null
  const normalized = trimmed.replace(/,/g, '')
  const [intPart, frac = ''] = normalized.split('.')
  const whole = (intPart || '0').replace(/^0+(?=\d)/, '') || '0'
  const cents = frac.length === 0 ? '00' : frac.length === 1 ? `${frac}0` : frac
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
