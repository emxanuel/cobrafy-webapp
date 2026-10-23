import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InstallmentStatusLabel } from '@/features/sales/components/installment-status-label'
import { CuotaDots, type DotStatus } from './cuota-dots'

const VARIANTS: Array<{
  status: DotStatus
  api: string
  hasPayment?: boolean
  dotClass: string
  word: string
  icon: string
}> = [
  { status: 'paid', api: 'paid', dotClass: 'bg-success', word: 'Pagada', icon: '●' },
  { status: 'partial', api: 'partial', dotClass: 'cuota-dot-partial', word: 'Parcial', icon: '◐' },
  { status: 'late', api: 'overdue', dotClass: 'bg-danger', word: 'Vencida', icon: '⚠' },
  {
    status: 'late-partial',
    api: 'overdue',
    hasPayment: true,
    dotClass: 'cuota-dot-late-partial',
    word: 'Vencida · abonada',
    icon: '⚠',
  },
  { status: 'pending', api: 'pending', dotClass: 'border-heading', word: 'Pendiente', icon: '○' },
  {
    status: 'pending-paid',
    api: 'pending',
    hasPayment: true,
    dotClass: 'cuota-dot-pending-paid',
    word: 'Pendiente · abonada',
    icon: '○',
  },
  {
    status: 'cancelled',
    api: 'cancelled',
    dotClass: 'cuota-dot-cancelled',
    word: 'Cancelada',
    icon: '⊘',
  },
]

function firstDot() {
  return screen.getByRole('img').querySelector('span')
}

describe('variantes de cuota', () => {
  it.each(VARIANTS)(
    '$word: clase del punto, ícono + palabra y aria-label',
    ({ status, api, hasPayment, dotClass, word, icon }) => {
      render(
        <div>
          <CuotaDots count={1} statuses={[status]} />
          <InstallmentStatusLabel status={api} hasPayment={hasPayment} />
        </div>,
      )
      expect(firstDot()).toHaveClass(dotClass)
      if (status === 'partial') {
        expect(firstDot()).not.toHaveClass('bg-danger')
        expect(firstDot()).not.toHaveClass('cuota-dot-late-partial')
      }
      if (status === 'pending-paid') {
        expect(firstDot()).not.toHaveClass('border-heading')
        expect(firstDot()).not.toHaveClass('opacity-55')
      }
      if (status === 'pending') {
        expect(firstDot()).not.toHaveClass('cuota-dot-pending-paid')
      }
      const label = screen.getByLabelText(word)
      expect(label).toHaveTextContent(icon)
      expect(label).toHaveTextContent(word)
    },
  )

  it('con más de 12 cuotas muestra +N y el aria-label cuenta todas', () => {
    render(
      <CuotaDots
        count={24}
        statuses={Array.from({ length: 24 }, () => 'pending')}
        summary={{ paid: 6, partial: 0, overdue: 1, pending: 17, cancelled: 0 }}
      />,
    )
    expect(screen.getByText('+12')).toBeInTheDocument()
    expect(screen.getByRole('img').querySelectorAll(':scope > span')).toHaveLength(13)
    expect(
      screen.getByLabelText('24 cuotas: 6 pagadas, 1 vencida, 17 pendientes'),
    ).toBeInTheDocument()
  })
})
