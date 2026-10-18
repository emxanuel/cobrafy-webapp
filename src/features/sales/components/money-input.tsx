import { useState } from 'react'

import { TextInput } from '@/features/shared/components/ui/field'
import { cn } from '@/features/shared/lib/cn'
import { formatAmountInput, parseMoneyInput } from '@/features/sales/lib/money-input'

export const MONEY_INVALID_MESSAGE = 'Monto inválido.'

export function MoneyInput({
  id,
  value,
  onValue,
  onInvalid,
  error,
  placeholder = '0.00',
  disabled = false,
}: {
  id: string
  value: string
  onValue: (canonical: string) => void
  onInvalid?: (invalid: boolean) => void
  error?: string
  placeholder?: string
  disabled?: boolean
}) {
  const [text, setText] = useState(value ? formatAmountInput(value) : '')
  const invalid = Boolean(text.trim()) && parseMoneyInput(text) === null
  const shownError = invalid ? MONEY_INVALID_MESSAGE : error

  return (
    <div className="relative">
      <span className="text-text pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px]">
        RD$
      </span>
      <TextInput
        id={id}
        inputMode="decimal"
        placeholder={placeholder}
        error={shownError}
        value={text}
        disabled={disabled}
        className={cn('tabular-nums pl-11')}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          const parsed = parseMoneyInput(next)
          const nextInvalid = Boolean(next.trim()) && parsed === null
          onValue(parsed ?? '')
          onInvalid?.(nextInvalid)
        }}
        onBlur={() => {
          const parsed = parseMoneyInput(text)
          if (parsed) {
            onValue(parsed)
            setText(formatAmountInput(parsed))
          }
        }}
      />
    </div>
  )
}
