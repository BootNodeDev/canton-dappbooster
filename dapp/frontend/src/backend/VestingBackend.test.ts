import type { ActiveContract } from '@bootnodedev/canton-connect'
import { describe, expect, it } from 'vitest'
import { encodeSchedule } from '@/backend/commands'
import {
  type AmuletPayload,
  amuletValue,
  claimChain,
  composeNote,
  contractToClaim,
  contractToGrant,
  contractToPendingGrant,
  lastUpdateOffset,
  splitNote,
  updatesToClaims,
  type VestingPayload,
} from '@/backend/VestingBackend'

const linearEncoded = encodeSchedule({
  cliff: '2026-01-01T00:00:00Z',
  curve: { kind: 'linear', start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
})

const contract = (
  contractId: string,
  payload: Record<string, unknown>,
): ActiveContract<VestingPayload> => ({
  contractId,
  templateId: '',
  payload,
  createdEventBlob: undefined,
  synchronizerId: undefined,
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

describe('contractToPendingGrant', () => {
  it('maps proposer→proposer, receiver→receiver, decodes the schedule, splits the note', () => {
    const pendingGrant = contractToPendingGrant(
      contract('p1', {
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

  it('returns undefined when the payload is absent', () => {
    const noPayload = {
      contractId: 'p1',
      templateId: '',
      payload: undefined,
      createdEventBlob: undefined,
      synchronizerId: undefined,
    } as unknown as Parameters<typeof contractToPendingGrant>[0]
    expect(contractToPendingGrant(noPayload)).toBeUndefined()
  })
})

describe('contractToGrant', () => {
  it('maps a contract, parsing alreadyWithdrawn and using creator as the funder', () => {
    const grant = contractToGrant(
      contract('c1', {
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
      contractToGrant(
        contract('c2', {
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
      contractToGrant(
        contract('c3', {
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

describe('contractToClaim', () => {
  it('maps a residual claim contract with amount + withdrawn', () => {
    const claim = contractToClaim(
      contract('r1', {
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
              choice: 'AmuletVestingContract_Withdraw',
              choiceArgument: { withdrawAmount: amount },
              contractId: replaces,
            },
          },
          {
            CreatedEvent: {
              contractId: successor,
              templateId: 'pkg:AmuletVesting:AmuletVestingContract',
              createArgument: {
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

  it('drops a transaction whose created event carries no contract id', () => {
    const full = claimUpdate(7, 'c1', 'c2', '250', '250')
    const events = full.update.Transaction.value.events
    const orphan = {
      update: {
        Transaction: {
          value: {
            ...full.update.Transaction.value,
            events: [
              events[0],
              { CreatedEvent: { ...events[1].CreatedEvent, contractId: undefined } },
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
  const amulet = (initialAmount: string): ActiveContract<AmuletPayload> => ({
    contractId: 'a1',
    templateId: '',
    payload: { amount: { initialAmount } },
    createdEventBlob: undefined,
    synchronizerId: undefined,
  })

  it('is the face amount, which is what a transfer credits an input at', () => {
    expect(amuletValue(amulet('100.0000000000'))).toBe('100.0000000000')
  })

  it('reads a contract it cannot decode as nothing, so a balance never blanks', () => {
    expect(amuletValue({ ...amulet('0'), payload: {} })).toBe('0')
  })
})
