import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Field, TextInput } from './field'

describe('Field error icon', () => {
  it('el ícono de error es aria-hidden', () => {
    render(
      <Field id="name" label="Nombre" error="Escribe el nombre.">
        <input id="name" />
      </Field>,
    )

    const alert = screen.getByRole('alert')
    const icons = alert.querySelectorAll('svg')
    expect(icons).toHaveLength(1)
    expect(icons[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('un input readOnly usa fondo muted, texto heading y anillo de foco', () => {
    render(<TextInput id="name" readOnly />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('read-only:bg-muted')
    expect(input).toHaveClass('read-only:text-heading')
    expect(input).toHaveClass('focus-visible:ring-2')
    expect(input).toHaveClass('focus-visible:ring-accent/40')
  })
})
