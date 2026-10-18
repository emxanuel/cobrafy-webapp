import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Field } from '@/features/shared/components/ui/field'
import { MoneyInput, MONEY_INVALID_MESSAGE } from './money-input'

function Harness({
  onValue,
  initial = '',
}: {
  onValue: (value: string) => void
  initial?: string
}) {
  const [value, setValue] = useState(initial)
  const [invalid, setInvalid] = useState(false)
  return (
    <Field id="precio" label="Precio" error={invalid ? MONEY_INVALID_MESSAGE : undefined}>
      <MoneyInput
        id="precio"
        value={value}
        onValue={(next) => {
          setValue(next)
          onValue(next)
        }}
        onInvalid={setInvalid}
      />
    </Field>
  )
}

describe('MoneyInput', () => {
  it('acepta 1,850.50, 1850 y 0.99', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    const { unmount } = render(<Harness onValue={onValue} />)
    await user.type(screen.getByLabelText('Precio'), '1,850.50')
    expect(onValue).toHaveBeenLastCalledWith('1850.50')
    expect(screen.queryByText(MONEY_INVALID_MESSAGE)).not.toBeInTheDocument()
    unmount()

    const onValuePlain = vi.fn()
    const second = render(<Harness onValue={onValuePlain} />)
    await user.type(screen.getByLabelText('Precio'), '1850')
    expect(onValuePlain).toHaveBeenLastCalledWith('1850.00')
    second.unmount()

    const onValueCents = vi.fn()
    render(<Harness onValue={onValueCents} />)
    await user.type(screen.getByLabelText('Precio'), '0.99')
    expect(onValueCents).toHaveBeenLastCalledWith('0.99')
  })

  it('1850O, 18500.999 y 1,5 muestran Monto inválido y llaman onValue vacio', async () => {
    const user = userEvent.setup()
    for (const typed of ['1850O', '18500.999', '1,5']) {
      const onValue = vi.fn()
      const { unmount } = render(<Harness onValue={onValue} />)
      await user.type(screen.getByLabelText('Precio'), typed)
      expect(onValue).toHaveBeenLastCalledWith('')
      expect(screen.getByText(MONEY_INVALID_MESSAGE)).toBeInTheDocument()
      unmount()
    }
  })
})
