import { describe, expect, it } from 'vitest'
import { atMidnight, dateOf } from '@/components/CreateGrant/fields'

describe('atMidnight', () => {
  it('starts the picked day at local midnight', () => {
    const day = new Date(atMidnight('2026-05-01'))
    expect([day.getFullYear(), day.getMonth(), day.getDate(), day.getHours()]).toEqual([
      2026, 4, 1, 0,
    ])
  })

  it('leaves a cleared input empty', () => {
    expect(atMidnight('')).toBe('')
  })
})

describe('dateOf', () => {
  it('reads back the day atMidnight was given', () => {
    expect(dateOf(atMidnight('2026-05-01'))).toBe('2026-05-01')
  })

  it('reads an instant as the local day it falls on', () => {
    expect(dateOf(new Date(2027, 0, 9, 23, 30).toISOString())).toBe('2027-01-09')
  })
})
