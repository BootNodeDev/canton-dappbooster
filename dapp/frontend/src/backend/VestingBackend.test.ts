import { describe, expect, it } from 'vitest'
import { encodeSchedule } from '@/backend/commands'
import {
  claimChain,
  composeNote,
  lastUpdateOffset,
  rowToClaim,
  rowToGrant,
  rowToProposal,
  splitNote,
  updatesToClaims,
} from '@/backend/VestingBackend'

const linearEncoded = encodeSchedule({
  cliff: '2026-01-01T00:00:00Z',
  curve: { kind: 'linear', start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
})

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

describe('rowToProposal', () => {
  it('maps proposer→proposer, beneficiary→receiver, decodes the schedule, splits the note', () => {
    const proposal = rowToProposal(
      row('p1', {
        provider: 'OP',
        proposer: 'funder',
        beneficiary: 'receiver',
        total: '1000.0000000000',
        schedule: linearEncoded,
        note: 'Advisor grant\n24-month linear',
      }),
    )
    expect(proposal).toEqual({
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
    expect(rowToProposal({})).toBeUndefined()
  })
})

describe('rowToGrant', () => {
  it('maps a contract row, parsing claimed and using proposer as creator', () => {
    const grant = rowToGrant(
      row('c1', {
        provider: 'OP',
        proposer: 'funder',
        beneficiary: 'receiver',
        total: '1000',
        claimed: '250',
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
          proposer: 'funder',
          beneficiary: 'receiver',
          total: '1000',
          claimed: 250, // wrong shape: a Daml Numeric always arrives as a string
          schedule: linearEncoded,
        }),
      ),
    ).toThrow(/c2.*claimed/)
  })

  it('throws on a string that is not a decimal, which would parse to zero downstream', () => {
    expect(() =>
      rowToGrant(
        row('c3', {
          provider: 'OP',
          proposer: 'funder',
          beneficiary: 'receiver',
          total: '1e3', // right shape, unparseable value
          claimed: '250',
          schedule: linearEncoded,
        }),
      ),
    ).toThrow(/c3.*total/)
  })
})

describe('rowToClaim', () => {
  it('maps a residual claim row with amount + withdrawn', () => {
    const claim = rowToClaim(
      row('r1', {
        provider: 'OP',
        proposer: 'funder',
        beneficiary: 'receiver',
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
              choice: 'Contract_Claim',
              choiceArgument: { amount },
              contractId: replaces,
            },
          },
          {
            CreatedEvent: {
              contractId: successor,
              createArgument: {
                provider: 'OP',
                proposer: 'funder',
                beneficiary: 'receiver',
                total: '1000',
                claimed,
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
