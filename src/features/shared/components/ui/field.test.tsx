import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Field } from './field'

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
})
