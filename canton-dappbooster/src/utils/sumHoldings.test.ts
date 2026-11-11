import { describe, expect, it } from 'vitest'
import { sumHoldings } from '#src/utils/sumHoldings'

const amulet = { admin: 'DSO::1220ab', id: 'Amulet' }
const other = { admin: 'circle::1220cd', id: 'USDC' }

const free = (amount: string, instrumentId = amulet) => ({ amount, instrumentId, isLocked: false })
const locked = (amount: string, instrumentId = amulet) => ({ amount, instrumentId, isLocked: true })

describe('sumHoldings', () => {
  it('sums the contracts of one instrument into one row', () => {
    expect(sumHoldings([free('10.5'), free('4')])).toEqual([
      { balance: '14.5', instrumentId: amulet, locked: '0' },
    ])
  })

  it('keeps locked apart from spendable', () => {
    expect(sumHoldings([free('10'), locked('2.5')])).toEqual([
      { balance: '10', instrumentId: amulet, locked: '2.5' },
    ])
  })

  it('adds exactly, where a float would drift', () => {
    expect(sumHoldings([free('0.1'), free('0.2')])[0].balance).toBe('0.3')
  })

  it('tells two registries apart, whatever they call the instrument', () => {
    const summed = sumHoldings([free('1'), free('2', { ...other, id: 'Amulet' })])
    expect(summed).toHaveLength(2)
    expect(summed.map(({ balance }) => balance)).toEqual(['1', '2'])
  })

  it('reports a party that holds only locked coin as spendable zero', () => {
    expect(sumHoldings([locked('7')])).toEqual([
      { balance: '0', instrumentId: amulet, locked: '7' },
    ])
  })

  it('reports nothing for a read that returned nothing', () => {
    expect(sumHoldings([])).toEqual([])
  })

  it('drops a holding whose amount is not an amount', () => {
    expect(sumHoldings([free('1'), free('n/a')])).toEqual([
      { balance: '1', instrumentId: amulet, locked: '0' },
    ])
  })
})
