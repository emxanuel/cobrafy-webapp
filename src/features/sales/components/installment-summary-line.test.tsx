import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InstallmentSummaryLine } from './installment-summary-line'

describe('InstallmentSummaryLine', () => {
  it('orden fijo, sin ceros, singular/plural y vencida en danger', () => {
    render(
      <InstallmentSummaryLine
        count={12}
        summary={{ paid: 3, partial: 1, overdue: 2, pending: 6, cancelled: 0 }}
      />,
    )
    expect(screen.getByText(/3 pagadas/).closest('p')?.textContent).toMatch(
      /●\s*3 pagadas\s*·\s*◐\s*1 parcial\s*·\s*⚠\s*2 vencidas\s*·\s*○\s*6 pendientes/,
    )
    expect(screen.queryByText(/0 /)).not.toBeInTheDocument()
    expect(screen.getByText(/2 vencidas/).closest('span')).toHaveClass('text-danger', 'font-semibold')
  })

  it('todas pagadas: Saldada', () => {
    render(
      <InstallmentSummaryLine
        count={24}
        summary={{ paid: 24, partial: 0, overdue: 0, pending: 0, cancelled: 0 }}
      />,
    )
    expect(screen.getByText(/Saldada · 24 pagadas/)).toHaveClass('text-success')
  })

  it('todas pendientes', () => {
    render(
      <InstallmentSummaryLine
        count={4}
        summary={{ paid: 0, partial: 0, overdue: 0, pending: 4, cancelled: 0 }}
      />,
    )
    expect(screen.getByText(/4 pendientes/)).toBeInTheDocument()
    expect(screen.queryByText(/pagada/)).not.toBeInTheDocument()
  })

  it('venta anulada: solo N canceladas', () => {
    render(
      <InstallmentSummaryLine
        voided
        count={4}
        summary={{ paid: 1, partial: 0, overdue: 0, pending: 0, cancelled: 4 }}
      />,
    )
    expect(screen.getByText(/4 canceladas/)).toBeInTheDocument()
    expect(screen.queryByText(/pagada/)).not.toBeInTheDocument()
  })

  it('no recalcula: ignora lo que vendría de installments', () => {
    render(
      <InstallmentSummaryLine
        count={12}
        summary={{ paid: 3, partial: 1, overdue: 0, pending: 8, cancelled: 0 }}
      />,
    )
    expect(screen.getByText(/3 pagadas/)).toBeInTheDocument()
    expect(screen.getByText(/1 parcial/)).toBeInTheDocument()
    expect(screen.getByText(/8 pendientes/)).toBeInTheDocument()
    expect(screen.queryByText(/12 pendientes/)).not.toBeInTheDocument()
  })
})
