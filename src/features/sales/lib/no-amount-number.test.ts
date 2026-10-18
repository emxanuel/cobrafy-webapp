import { describe, expect, it } from 'vitest'

const sources = import.meta.glob('@/features/sales/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

describe('features/sales no convierte montos a number', () => {
  it('falla si hay parseFloat, Number( o +unario sobre montos', () => {
    const files = Object.entries(sources).filter(([path]) => !path.includes('.test.'))
    expect(files.length).toBeGreaterThan(0)
    for (const [file, src] of files) {
      expect(src, file).not.toMatch(/\bparseFloat\s*\(/)
      expect(src, file).not.toMatch(/(?<![\w.])Number\s*\(/)
      expect(src, file).not.toMatch(
        /\+[A-Za-z_][A-Za-z0-9_]*(price|amount|total|surcharge|down|money|financed)/i,
      )
    }
  })
})
