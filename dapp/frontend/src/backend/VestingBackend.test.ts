import { describe, expect, it } from 'vitest'
import { encodeSchedule } from './commands'
import { composeNote, rowToClaim, rowToGrant, rowToProposal, splitNote } from './VestingBackend'

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
      totalAmount: 1000,
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
    expect(grant?.totalAmount).toBe(1000)
    expect(grant?.alreadyWithdrawn).toBe(250)
    expect(grant?.note).toBeUndefined()
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
      amount: 500,
      withdrawn: 100,
      note: 'from cancelled grant',
    })
  })
})
