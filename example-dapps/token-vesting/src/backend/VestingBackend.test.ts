import { describe, expect, it } from 'vitest'
import { encodeSchedule } from '@/backend/commands'
import type { AcsRow } from '@/backend/VestingBackend'
import {
  claimChain,
  composeNote,
  lastUpdateOffset,
  matchesInstrument,
  reservedToken,
  rowToClaim,
  rowToGrant,
  rowToPendingGrant,
  selectHoldings,
  splitNote,
  tokenValue,
  updatesToClaims,
} from '@/backend/VestingBackend'

const linearEncoded = encodeSchedule({
  cliff: '2026-01-01T00:00:00Z',
  curve: { kind: 'linear', start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
})

const INSTRUMENT = { admin: 'admin::1', instrumentId: 'DBT' }

const row = (contractId: string, arg: Record<string, unknown>) => ({
  contractEntry: { JsActiveContract: { createdEvent: { contractId, createArgument: arg } } },
})

describe('splitNote / composeNote', () => {
  it('splits on the first newline into title + note', () => {
    expect(splitNote('My grant\nthe rest\nmore', 'cid1234')).toEqual({
      title: 'My grant',
      note: 'the rest\nmore',
    })
  })

  it('treats a note with no newline as title-only', () => {
    expect(splitNote('Just a title', 'cid1234')).toEqual({ title: 'Just a title' })
  })

  it('falls back to a short-cid title when the note is empty', () => {
    expect(splitNote('', 'cid12345678')).toEqual({ title: 'Vesting cid12345' })
  })

  it('composeNote joins title + note with a newline, title-only when note absent', () => {
    expect(composeNote('T', 'body')).toBe('T\nbody')
    expect(composeNote('T')).toBe('T')
    expect(composeNote('T', '')).toBe('T')
  })
})

describe('rowToPendingGrant', () => {
  it('maps proposer→proposer, receiver→receiver, decodes the schedule, splits the note', () => {
    const pendingGrant = rowToPendingGrant(
      row('p1', {
        provider: 'OP',
        proposer: 'funder',
        receiver: 'receiver',
        totalAmount: '1000.0000000000',
        schedule: linearEncoded,
        note: 'Advisor grant\n24-month linear',
      }),
    )
    expect(pendingGrant).toEqual({
      id: 'p1',
      title: 'Advisor grant',
      provider: 'OP',
      proposer: 'funder',
      receiver: 'receiver',
      // Passed through unparsed: a Daml Numeric arrives as a string, verbatim ledger padding included.
      totalAmount: '1000.0000000000',
      schedule: {
        cliff: '2026-01-01T00:00:00Z',
        curve: { kind: 'linear', start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
      },
      note: '24-month linear',
    })
  })

  it('returns undefined when the createArgument is absent', () => {
    expect(rowToPendingGrant({})).toBeUndefined()
  })
})

describe('rowToGrant', () => {
  it('maps a contract row, parsing alreadyWithdrawn and using creator as the funder', () => {
    const grant = rowToGrant(
      row('c1', {
        provider: 'OP',
        creator: 'funder',
        receiver: 'receiver',
        totalAmount: '1000',
        alreadyWithdrawn: '250',
        schedule: linearEncoded,
        note: 'Core grant',
      }),
    )
    expect(grant?.id).toBe('c1')
    expect(grant?.title).toBe('Core grant')
    expect(grant?.creator).toBe('funder')
    expect(grant?.receiver).toBe('receiver')
    expect(grant?.totalAmount).toBe('1000')
    expect(grant?.alreadyWithdrawn).toBe('250')
    expect(grant?.note).toBeUndefined()
  })

  it('throws naming the field rather than folding a non-string amount to zero', () => {
    expect(() =>
      rowToGrant(
        row('c2', {
          provider: 'OP',
          creator: 'funder',
          receiver: 'receiver',
          totalAmount: '1000',
          alreadyWithdrawn: 250, // wrong shape: a Daml Numeric always arrives as a string
          schedule: linearEncoded,
        }),
      ),
    ).toThrow(/c2.*alreadyWithdrawn/)
  })

  it('throws on a string that is not a decimal, which would parse to zero downstream', () => {
    expect(() =>
      rowToGrant(
        row('c3', {
          provider: 'OP',
          creator: 'funder',
          receiver: 'receiver',
          totalAmount: '1e3', // right shape, unparseable value
          alreadyWithdrawn: '250',
          schedule: linearEncoded,
        }),
      ),
    ).toThrow(/c3.*totalAmount/)
  })
})

describe('rowToClaim', () => {
  it('maps a residual claim row with amount + withdrawn', () => {
    const claim = rowToClaim(
      row('r1', {
        provider: 'OP',
        creator: 'funder',
        receiver: 'receiver',
        amount: '500',
        withdrawn: '100',
        note: 'Residual\nfrom cancelled grant',
      }),
    )
    expect(claim).toEqual({
      id: 'r1',
      title: 'Residual',
      provider: 'OP',
      creator: 'funder',
      receiver: 'receiver',
      amount: '500',
      withdrawn: '100',
      note: 'from cancelled grant',
    })
  })
})

const claimUpdate = (
  offset: number,
  replaces: string,
  successor: string,
  claimed: string,
  amount: string,
) => ({
  update: {
    Transaction: {
      value: {
        effectiveAt: '2026-03-01T00:00:00Z',
        offset,
        events: [
          {
            ExercisedEvent: {
              choice: 'VestingContract_Withdraw',
              choiceArgument: { withdrawAmount: amount },
              contractId: replaces,
            },
          },
          {
            CreatedEvent: {
              contractId: successor,
              templateId: 'pkg1:Vesting:VestingContract',
              createArgument: {
                admin: 'admin::1',
                instrumentId: 'DBT',
                provider: 'OP',
                creator: 'funder',
                receiver: 'receiver',
                totalAmount: '1000',
                alreadyWithdrawn: claimed,
                schedule: linearEncoded,
                note: 'Advisor grant',
              },
            },
          },
        ],
      },
    },
  },
})

// The resolved id LedgerBackend spells its own commands with, which is where this comes from.
const SUCCESSOR = 'pkg1:Vesting:VestingContract'

describe('updatesToClaims', () => {
  // A withdraw pays the receiver as well as replacing the grant, so its transaction carries a
  // `Token` create the receiver is an informee of. Its payload is `{admin, instrumentId, amount}`,
  // which the instrument filter accepts, so picking the first create rather than the successor's
  // own template threw on the `totalAmount` it has no field for and lost the whole history.
  it('skips the holding the withdraw paid out, even when it comes first', () => {
    const { update } = claimUpdate(7, 'c1', 'c2', '250', '250')
    const paidOut = {
      CreatedEvent: {
        contractId: 'paid-out',
        templateId: 'tfpkg:Canton.TokenForge.Token:Token',
        createArgument: { admin: 'admin::1', instrumentId: 'DBT', amount: '250' },
      },
    }
    const { events, ...value } = update.Transaction.value
    const withHolding = {
      update: { Transaction: { value: { ...value, events: [events[0], paidOut, events[1]] } } },
    }

    const [record] = updatesToClaims([withHolding], INSTRUMENT, SUCCESSOR)

    expect(record?.grant.id).toBe('c2')
  })

  // A grant created before the package was upgraded is still its own successor, so the match is on
  // module and entity rather than on the whole resolved id.
  it('accepts a successor created under another version of the package', () => {
    const [record] = updatesToClaims(
      [claimUpdate(7, 'c1', 'c2', '250', '250')],
      INSTRUMENT,
      'otherpkg:Vesting:VestingContract',
    )
    expect(record?.grant.id).toBe('c2')
  })

  it('carries the id the claim consumed alongside the successor it created', () => {
    const [record] = updatesToClaims(
      [claimUpdate(7, 'c1', 'c2', '250', '250')],
      INSTRUMENT,
      SUCCESSOR,
    )
    expect(record?.replaces).toBe('c1')
    expect(record?.grant.id).toBe('c2')
    expect(record?.amount).toBe('250')
  })

  it('drops a transaction with no exercised contract id, which cannot be placed in a chain', () => {
    const full = claimUpdate(7, 'c1', 'c2', '250', '250')
    const events = full.update.Transaction.value.events
    const orphan = {
      update: {
        Transaction: {
          value: {
            ...full.update.Transaction.value,
            events: [
              { ExercisedEvent: { ...events[0].ExercisedEvent, contractId: undefined } },
              events[1],
            ],
          },
        },
      },
    }
    expect(updatesToClaims([orphan], INSTRUMENT, SUCCESSOR)).toEqual([])
  })

  it('ignores anything that is not an array of transactions', () => {
    expect(updatesToClaims(undefined, INSTRUMENT, SUCCESSOR)).toEqual([])
    expect(updatesToClaims([{}], INSTRUMENT, SUCCESSOR)).toEqual([])
  })
})

describe('claimChain', () => {
  const records = updatesToClaims(
    [
      claimUpdate(7, 'c1', 'c2', '250', '250'),
      claimUpdate(9, 'c2', 'c3', '500', '250'),
      claimUpdate(11, 'other1', 'other2', '10', '10'),
    ],
    INSTRUMENT,
    SUCCESSOR,
  )

  it('walks a grant back through the contracts its own claims replaced, newest first', () => {
    expect(claimChain(records, 'c3').map((r) => r.grant.id)).toEqual(['c3', 'c2'])
  })

  it('leaves out another grant chain the same party can see', () => {
    expect(claimChain(records, 'c3').map((r) => r.replaces)).not.toContain('other1')
  })

  it('is empty for a contract nothing has claimed from yet', () => {
    expect(claimChain(records, 'never-claimed')).toEqual([])
  })
})

describe('lastUpdateOffset', () => {
  it('reports the offset of the final entry, which is where the next page resumes', () => {
    expect(
      lastUpdateOffset([
        claimUpdate(7, 'c1', 'c2', '250', '250'),
        claimUpdate(9, 'c2', 'c3', '500', '250'),
      ]),
    ).toBe(9)
  })

  it('is undefined for an empty or non-array page, so paging stops', () => {
    expect(lastUpdateOffset([])).toBeUndefined()
    expect(lastUpdateOffset(undefined)).toBeUndefined()
  })
})

const tokenRow = (contractId: string, amount: string, overrides: Record<string, unknown> = {}) =>
  ({
    contractEntry: {
      JsActiveContract: {
        createdEvent: {
          contractId,
          createArgument: { admin: 'admin::1', instrumentId: 'DBT', amount, ...overrides },
        },
      },
    },
  }) as AcsRow

describe('tokenValue', () => {
  it('reads the holding amount off the payload', () => {
    expect(tokenValue(tokenRow('t1', '1000.5'))).toBe('1000.5')
  })

  // Lenient where the mappers throw: this feeds a balance, and one odd row must not blank it.
  it('reads a row carrying no amount as zero', () => {
    expect(tokenValue({} as AcsRow)).toBe('0')
  })
})

describe('matchesInstrument', () => {
  it('accepts a holding of the deployment’s own instrument', () => {
    expect(matchesInstrument(tokenRow('t1', '1'), INSTRUMENT)).toBe(true)
  })

  it('rejects the same instrument id under another admin', () => {
    expect(matchesInstrument(tokenRow('t1', '1', { admin: 'other::1' }), INSTRUMENT)).toBe(false)
  })

  it('rejects another instrument of the same admin', () => {
    expect(matchesInstrument(tokenRow('t1', '1', { instrumentId: 'OTHER' }), INSTRUMENT)).toBe(
      false,
    )
  })
})

describe('reservedToken', () => {
  it('reads the holding a pending grant’s Accept will consume', () => {
    const pending = {
      contractEntry: {
        JsActiveContract: {
          createdEvent: {
            contractId: 'p1',
            createArgument: { tokenCid: 't1' },
          },
        },
      },
    } as AcsRow
    expect(reservedToken(pending)).toBe('t1')
  })

  it('reads a row naming none as undefined', () => {
    expect(reservedToken({} as AcsRow)).toBeUndefined()
  })
})

describe('selectHoldings', () => {
  // Largest first, so the factory splits the fewest inputs: the receiver carries one disclosure
  // whatever is picked, since the split leaves a single holding behind.
  it('takes the largest holdings first and stops once they cover the total', () => {
    const rows = [tokenRow('small', '100'), tokenRow('big', '900'), tokenRow('mid', '400')]
    expect(selectHoldings(rows, '1000')?.map((row) => tokenValue(row))).toEqual(['900', '400'])
  })

  it('takes one holding when one covers the total', () => {
    const rows = [tokenRow('big', '900'), tokenRow('small', '100')]
    expect(selectHoldings(rows, '500')?.map((row) => tokenValue(row))).toEqual(['900'])
  })

  it('takes everything when the total needs everything', () => {
    const rows = [tokenRow('a', '600'), tokenRow('b', '400')]
    expect(selectHoldings(rows, '1000')).toHaveLength(2)
  })

  it('returns undefined rather than an under-covering set', () => {
    expect(selectHoldings([tokenRow('a', '600')], '1000')).toBeUndefined()
  })

  it('returns undefined when there is nothing to select from', () => {
    expect(selectHoldings([], '1')).toBeUndefined()
  })

  it('returns undefined for a non-positive total rather than an empty set', () => {
    const rows = [tokenRow('a', '600')]
    expect(selectHoldings(rows, '0')).toBeUndefined()
    expect(selectHoldings(rows, '-1')).toBeUndefined()
  })
})
