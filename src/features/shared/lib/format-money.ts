/** Formats a decimal string as `RD$ 1,500.00`. Never converts the amount to a number. */
export function formatMoney(amount: string): string {
  const trimmed = amount.trim()
  if (!trimmed) return 'RD$ 0.00'

  const negative = trimmed.startsWith('-')
  const unsigned = negative ? trimmed.slice(1) : trimmed
  const [rawInt = '0', rawFrac = ''] = unsigned.split('.')
  const intDigits = (rawInt.replace(/\D/g, '') || '0').replace(/^0+(?=\d)/, '')
  const frac = `${rawFrac}00`.replace(/\D/g, '').slice(0, 2).padEnd(2, '0')
  const grouped = intDigits.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
  return `${negative ? '-' : ''}RD$ ${grouped}.${frac}`
}
