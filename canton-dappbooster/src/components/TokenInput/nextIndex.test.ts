import { describe, expect, it } from 'vitest'
import { nextIndex } from '#src/components/TokenInput/nextIndex'

const PAGE = 10
const LAST = 99

describe('nextIndex', () => {
  it('steps one row with the arrows', () => {
    expect(nextIndex('ArrowDown', 4, PAGE, LAST)).toBe(5)
    expect(nextIndex('ArrowUp', 4, PAGE, LAST)).toBe(3)
  })

  it('steps a page with PageDown and PageUp', () => {
    expect(nextIndex('PageDown', 4, PAGE, LAST)).toBe(14)
    expect(nextIndex('PageUp', 40, PAGE, LAST)).toBe(30)
  })

  it('jumps to either end', () => {
    expect(nextIndex('Home', 40, PAGE, LAST)).toBe(0)
    expect(nextIndex('End', 40, PAGE, LAST)).toBe(LAST)
  })

  // Clamping is the caller's, which is what lets it clamp against a list length this cannot see.
  it('runs past either end rather than clamping', () => {
    expect(nextIndex('ArrowUp', 0, PAGE, LAST)).toBe(-1)
    expect(nextIndex('PageDown', LAST, PAGE, LAST)).toBe(LAST + PAGE)
  })

  it('reports nothing for a key that moves no row', () => {
    expect(nextIndex('Enter', 4, PAGE, LAST)).toBeUndefined()
    expect(nextIndex('a', 4, PAGE, LAST)).toBeUndefined()
  })
})
