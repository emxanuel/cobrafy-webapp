import { useState } from 'react'

import { TextInput } from '@/features/shared/components/ui/field'
import { cn } from '@/features/shared/lib/cn'
import { formatAmountInput, parseMoneyInput } from '@/features/sales/lib/money-input'

export function MoneyInput({
  id,
  value,
  onValue,
  error,
  placeholder = '0.00',
}: {
  id: string
  value: string
  onValue: (canonical: string) => void
  error?: string
  placeholder?: string
}) {
  const [text, setText] = useState(value ? formatAmountInput(value) : '')

  return (
    <div className="relative">
      <span className="text-text pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px]">
        RD$
      </span>
      <TextInput
        id={id}
        inputMode="decimal"
        placeholder={placeholder}
        error={error}
        value={text}
        className={cn('tabular-nums pl-11')}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          const parsed = parseMoneyInput(next)
          if (parsed) onValue(parsed)
          if (!next.trim()) onValue('')
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
