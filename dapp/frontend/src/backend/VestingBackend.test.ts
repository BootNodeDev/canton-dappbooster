import { describe, expect, it } from 'vitest'
import { encodeSchedule } from '@/backend/commands'
import {
  amuletValue,
  claimChain,
  composeNote,
  lastUpdateOffset,
  rowToClaim,
  rowToGrant,
  rowToPendingGrant,
  splitNote,
  updatesToClaims,
} from '@/backend/VestingBackend'

const linearEncoded = encodeSchedule({
  cliff: '2026-01-01T00:00:00Z',
  curve: { kind: 'linear', start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
})

const ctx = { amuletRules: 'rules-cid', openMiningRound: 'round-cid', featuredAppRight: null }

const row = (contractId: string, arg: Record<string, unknown>) => ({
  contractEntry: { JsActiveContract: { createdEvent: { contractId, createArgument: arg } } },
})

// The generated decoders read the whole payload, so a fixture carries every field the template has.
const proposal = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  provider: 'OP',
  proposer: 'funder',
  receiver: 'receiver',
  totalAmount: '1000',
  schedule: linearEncoded,
  amuletCids: ['amulet-1'],
  note: null,
  ...overrides,
})

const contract = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  provider: 'OP',
  creator: 'funder',
  receiver: 'receiver',
  dso: 'dso::1',
  totalAmount: '1000',
  schedule: linearEncoded,
  alreadyWithdrawn: '250',
  lockedAmuletCid: 'locked-1',
  note: null,
  ...overrides,
})

const claim = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  provider: 'OP',
  creator: 'funder',
  receiver: 'receiver',
  dso: 'dso::1',
  amount: '500',
  withdrawn: '100',
  lockedAmuletCid: 'locked-1',
  note: null,
  ...overrides,
})

const amulet = (initialAmount: string): Record<string, unknown> => ({
  dso: 'dso::1',
  owner: 'funder',
  amount: { initialAmount, createdAt: { number: '1' }, ratePerRound: { rate: '0.0' } },
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
      row(
        'p1',
        proposal({ totalAmount: '1000.0000000000', note: 'Advisor grant\n24-month linear' }),
      ),
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
    const grant = rowToGrant(row('c1', contract({ note: 'Core grant' })))
    expect(grant?.id).toBe('c1')
    expect(grant?.title).toBe('Core grant')
    expect(grant?.creator).toBe('funder')
    expect(grant?.receiver).toBe('receiver')
    expect(grant?.totalAmount).toBe('1000')
    expect(grant?.alreadyWithdrawn).toBe('250')
    expect(grant?.note).toBeUndefined()
  })

  it('throws naming the field the decoder rejected rather than folding it to zero', () => {
    // A Daml Numeric always arrives as a string.
    expect(() => rowToGrant(row('c2', contract({ alreadyWithdrawn: 250 })))).toThrow(
      /c2.*alreadyWithdrawn/,
    )
  })

  it('throws naming the field the decoder let through as an unparseable decimal', () => {
    expect(() => rowToGrant(row('c3', contract({ totalAmount: '1e3' })))).toThrow(/c3.*totalAmount/)
  })

  it('throws naming the template when the payload is missing a field altogether', () => {
    const { lockedAmuletCid, ...incomplete } = contract()
    expect(() => rowToGrant(row('c4', incomplete))).toThrow(/c4.*AmuletVestingContract/)
  })
})

describe('rowToClaim', () => {
  it('maps a residual claim row with amount + withdrawn', () => {
    const residual = rowToClaim(row('r1', claim({ note: 'Residual\nfrom cancelled grant' })))
    expect(residual).toEqual({
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
              choice: 'AmuletVestingContract_Withdraw',
              choiceArgument: { withdrawAmount: amount, ctx },
              contractId: replaces,
            },
          },
          {
            CreatedEvent: {
              contractId: successor,
              createArgument: contract({ alreadyWithdrawn: claimed, note: 'Advisor grant' }),
            },
          },
        ],
      },
    },
  },
})

describe('updatesToClaims', () => {
  it('carries the id the claim consumed alongside the successor it created', () => {
    const [record] = updatesToClaims([claimUpdate(7, 'c1', 'c2', '250', '250')])
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
    expect(updatesToClaims([orphan])).toEqual([])
  })

  it('ignores anything that is not an array of transactions', () => {
    expect(updatesToClaims(undefined)).toEqual([])
    expect(updatesToClaims([{}])).toEqual([])
  })
})

describe('claimChain', () => {
  const records = updatesToClaims([
    claimUpdate(7, 'c1', 'c2', '250', '250'),
    claimUpdate(9, 'c2', 'c3', '500', '250'),
    claimUpdate(11, 'other1', 'other2', '10', '10'),
  ])

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

describe('amuletValue', () => {
  it('is the face amount, which is what a transfer credits an input at', () => {
    expect(amuletValue(row('a1', amulet('100.0000000000')))).toBe('100.0000000000')
  })

  it('reads a row it cannot decode as nothing, so a balance never blanks', () => {
    expect(amuletValue(row('a1', {}))).toBe('0')
  })
})
