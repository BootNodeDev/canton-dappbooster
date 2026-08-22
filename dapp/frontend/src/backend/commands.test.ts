import { describe, expect, it } from 'vitest'
import {
  buildAcceptCommand,
  buildCancelCommand,
  buildClaimCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
  decodeSchedule,
  encodeSchedule,
} from '@/backend/commands'
import type { VestingSchedule } from '@/lib/schedule'

const linear: VestingSchedule = {
  cliff: '2026-01-01T00:00:00Z',
  curve: { kind: 'linear', start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
}

const milestone: VestingSchedule = {
  cliff: '2026-02-01T00:00:00Z',
  curve: {
    kind: 'milestone',
    points: [
      { time: '2026-02-01T00:00:00Z', fraction: 0.4 },
      { time: '2026-08-01T00:00:00Z', fraction: 1.0 },
    ],
  },
}

describe('encodeSchedule', () => {
  it('encodes a linear curve as a tagged variant with an ISO start/end record', () => {
    expect(encodeSchedule(linear)).toEqual({
      curve: {
        tag: 'LinearVesting',
        value: { start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
      },
      cliff: '2026-01-01T00:00:00Z',
    })
  })

  it('encodes a milestone curve as tagged points with _1/_2 tuple records, Decimal as string', () => {
    expect(encodeSchedule(milestone)).toEqual({
      curve: {
        tag: 'MilestoneVesting',
        value: {
          points: [
            { _1: '2026-02-01T00:00:00Z', _2: '0.4' },
            { _1: '2026-08-01T00:00:00Z', _2: '1' },
          ],
        },
      },
      cliff: '2026-02-01T00:00:00Z',
    })
  })
})

describe('decodeSchedule', () => {
  it('round-trips a linear schedule', () => {
    expect(decodeSchedule(encodeSchedule(linear))).toEqual(linear)
  })

  it('round-trips a milestone schedule', () => {
    expect(decodeSchedule(encodeSchedule(milestone))).toEqual(milestone)
  })

  it('falls back to a degenerate linear curve on garbage input', () => {
    expect(decodeSchedule(undefined)).toEqual({
      cliff: '',
      curve: { kind: 'linear', start: '', end: '' },
    })
  })
})

describe('command builders', () => {
  it('buildCreateVestingCommand shapes Factory_CreateVesting args with the encoded schedule', () => {
    const cmd = buildCreateVestingCommand('TID', 'fcid', {
      proposer: 'P',
      beneficiary: 'B',
      total: '1000',
      schedule: linear,
      note: 'Title\nbody',
    })
    expect(cmd).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'fcid',
        choice: 'Factory_CreateVesting',
        choiceArgument: {
          proposer: 'P',
          beneficiary: 'B',
          total: '1000',
          schedule: encodeSchedule(linear),
          note: 'Title\nbody',
        },
      },
    })
  })

  it('buildCreateVestingCommand sends null note when omitted', () => {
    const cmd = buildCreateVestingCommand('TID', 'fcid', {
      proposer: 'P',
      beneficiary: 'B',
      total: '1',
      schedule: linear,
    })
    expect((cmd.ExerciseCommand.choiceArgument as { note: unknown }).note).toBeNull()
  })

  it('buildClaimCommand carries amount and no nowMicros (getTime)', () => {
    expect(buildClaimCommand('TID', 'cid', '100')).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'cid',
        choice: 'Contract_Claim',
        choiceArgument: { amount: '100' },
      },
    })
  })

  it('buildAcceptCommand targets Proposal_Accept', () => {
    expect(buildAcceptCommand('TID', 'pcid')).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'pcid',
        choice: 'Proposal_Accept',
        choiceArgument: {},
      },
    })
  })

  it('buildCancelCommand targets Contract_Cancel with no args', () => {
    expect(buildCancelCommand('TID', 'ccid')).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'ccid',
        choice: 'Contract_Cancel',
        choiceArgument: {},
      },
    })
  })

  it('buildClaimResidualCommand targets Claim_Withdraw and carries withdrawAmount', () => {
    expect(buildClaimResidualCommand('TID', 'rcid', '50')).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'rcid',
        choice: 'Claim_Withdraw',
        choiceArgument: { withdrawAmount: '50' },
      },
    })
  })

  it('canonicalizes a trailing-dot amount before it reaches the payload', () => {
    // A Daml Numeric literal has no trailing-dot form; the input filters upstream let '1000.' through.
    const cmd = buildCreateVestingCommand('TID', 'fcid', {
      proposer: 'P',
      beneficiary: 'B',
      total: '1000.',
      schedule: linear,
    })
    expect((cmd.ExerciseCommand.choiceArgument as { total: string }).total).toBe('1000')
    expect(buildClaimCommand('TID', 'cid', '100.').ExerciseCommand.choiceArgument.amount).toBe(
      '100',
    )
    expect(
      buildClaimResidualCommand('TID', 'rcid', '50.').ExerciseCommand.choiceArgument.withdrawAmount,
    ).toBe('50')
  })

  it('rejects a malformed amount rather than sending it to the ledger', () => {
    expect(() => buildClaimCommand('TID', 'cid', 'not-a-number')).toThrow()
  })
})
