import { describe, expect, it } from 'vitest'

import {
  addCalendarYears,
  BUSINESS_ZONE,
  lastDayOfMonth,
  quincenalOptions,
  todayParts,
  type DateParts,
} from './calendar'

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

  it.each([
    ['UTC', 'UTC'],
    ['America/Santo_Domingo', BUSINESS_ZONE],
  ] as const)('en %s lista el 15 y el fin de mes del día civil', (_label, zone) => {
    const now = new Date('2026-10-18T16:00:00.000Z')
    const from = todayParts(now, zone)
    const options = quincenalOptions(from, addCalendarYears(from, 1))
    expect(from).toEqual({ year: 2026, month: 10, day: 18 })
    expect(options.map((item) => item.iso)).toEqual([
      '2026-10-31',
      '2026-11-15',
      '2026-11-30',
      '2026-12-15',
      '2026-12-31',
      '2027-01-15',
      '2027-01-31',
      '2027-02-15',
      '2027-02-28',
      '2027-03-15',
      '2027-03-31',
      '2027-04-15',
      '2027-04-30',
      '2027-05-15',
      '2027-05-31',
      '2027-06-15',
      '2027-06-30',
      '2027-07-15',
      '2027-07-31',
      '2027-08-15',
      '2027-08-31',
      '2027-09-15',
      '2027-09-30',
      '2027-10-15',
    ])
    expect(options.every((item) => item.kind === 'day15' || item.kind === 'month_end')).toBe(true)
  })
})
