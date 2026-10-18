import { describe, expect, it } from 'vitest'

const sources = {
  ...import.meta.glob('@/features/sales/**/*.{ts,tsx}', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
  ...import.meta.glob('@/pages/sales/**/*.{ts,tsx}', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
  ...import.meta.glob('@/features/shared/lib/**/*.{ts,tsx}', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
} as Record<string, string>

describe('sales y shared/lib no convierten montos a number', () => {
  it('falla si hay parseFloat, Number(, +unario, toFixed o Math', () => {
    const files = Object.entries(sources).filter(([path]) => !path.includes('.test.'))
    expect(files.length).toBeGreaterThan(0)
    for (const [file, src] of files) {
      expect(src, file).not.toMatch(/\bparseFloat\s*\(/)
      expect(src, file).not.toMatch(/(?<![\w.])Number\s*\(/)
      expect(src, file).not.toMatch(
        /\+[A-Za-z_][A-Za-z0-9_]*(price|amount|total|surcharge|down|money|financed)/i,
      )
      expect(src, file).not.toMatch(/\.toFixed\s*\(/)
      expect(src, file).not.toMatch(/\bMath\./)
    }
  })
})
