import { describe, expect, it } from 'vitest'

import { lastDayOfMonth, quincenalOptions, type DateParts } from './calendar'

describe('quincenalOptions', () => {
  it('solo ofrece el 15 y el último día real del mes', () => {
    const from: DateParts = { year: 2026, month: 10, day: 18 }
    const until: DateParts = { year: 2027, month: 2, day: 18 }
    const options = quincenalOptions(from, until)
    expect(options.every((item) => item.kind === 'day15' || item.kind === 'month_end')).toBe(true)
    expect(options.map((item) => item.iso)).toEqual([
      '2026-10-31',
      '2026-11-15',
      '2026-11-30',
      '2026-12-15',
      '2026-12-31',
      '2027-01-15',
      '2027-01-31',
      '2027-02-15',
    ])
    expect(lastDayOfMonth(2026, 2)).toBe(28)
    expect(lastDayOfMonth(2028, 2)).toBe(29)
  })
})
