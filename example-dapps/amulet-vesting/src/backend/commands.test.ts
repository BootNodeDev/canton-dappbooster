import { describe, expect, it } from 'vitest'
import {
  buildAcceptCommand,
  buildCancelCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
  buildTapCommand,
  buildWithdrawCommand,
  decodeSchedule,
  encodeSchedule,
  TAP_AMOUNT,
} from '@/backend/commands'
import type { AppTransferContext } from '@/backend/transferContext'
import type { VestingSchedule } from '@/utils/schedule'

const ctx: AppTransferContext = {
  amuletRules: 'rules-cid',
  openMiningRound: 'round-cid',
  featuredAppRight: null,
}

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
  it('buildCreateVestingCommand shapes the factory choice with the encoded schedule', () => {
    const cmd = buildCreateVestingCommand('TID', 'fcid', {
      proposer: 'P',
      receiver: 'B',
      totalAmount: '1000',
      schedule: linear,
      amuletCids: ['a1', 'a2'],
      note: 'Title\nbody',
    })
    expect(cmd).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'fcid',
        choice: 'AmuletVestingFactory_CreateVesting',
        choiceArgument: {
          proposer: 'P',
          receiver: 'B',
          totalAmount: '1000',
          schedule: encodeSchedule(linear),
          amuletCids: ['a1', 'a2'],
          note: 'Title\nbody',
        },
      },
    })
  })

  it('buildCreateVestingCommand sends null note when omitted', () => {
    const cmd = buildCreateVestingCommand('TID', 'fcid', {
      proposer: 'P',
      receiver: 'B',
      totalAmount: '1',
      schedule: linear,
      amuletCids: [],
    })
    expect((cmd.ExerciseCommand.choiceArgument as { note: unknown }).note).toBeNull()
  })

  it('buildWithdrawCommand carries the amount and the context, no nowMicros (getTime)', () => {
    expect(buildWithdrawCommand('TID', 'cid', '100', ctx)).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'cid',
        choice: 'AmuletVestingContract_Withdraw',
        choiceArgument: { withdrawAmount: '100', ctx },
      },
    })
  })

  it('buildAcceptCommand carries the flat transfer context and nothing else', () => {
    expect(buildAcceptCommand('TID', 'pcid', ctx)).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'pcid',
        choice: 'AmuletVestingProposal_Accept',
        choiceArgument: { ctx },
      },
    })
  })

  it('buildCancelCommand takes the context as its only argument', () => {
    expect(buildCancelCommand('TID', 'ccid', ctx)).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'ccid',
        choice: 'AmuletVestingContract_Cancel',
        choiceArgument: { ctx },
      },
    })
  })

  it('buildClaimResidualCommand targets the residual claim and carries withdrawAmount', () => {
    expect(buildClaimResidualCommand('TID', 'rcid', '50', ctx)).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'rcid',
        choice: 'AmuletVestedClaim_Withdraw',
        choiceArgument: { withdrawAmount: '50', ctx },
      },
    })
  })

  it('buildTapCommand exercises AmuletRules itself, for the fixed amount', () => {
    expect(
      buildTapCommand('RULESTID', ctx.amuletRules, {
        openMiningRound: ctx.openMiningRound,
        receiver: 'P',
      }),
    ).toEqual({
      ExerciseCommand: {
        templateId: 'RULESTID',
        contractId: 'rules-cid',
        choice: 'AmuletRules_DevNet_Tap',
        choiceArgument: { receiver: 'P', amount: TAP_AMOUNT, openRound: 'round-cid' },
      },
    })
  })

  it('canonicalizes a trailing-dot amount before it reaches the payload', () => {
    // A Daml Numeric literal has no trailing-dot form; the input filters upstream let '1000.' through.
    const cmd = buildCreateVestingCommand('TID', 'fcid', {
      proposer: 'P',
      receiver: 'B',
      totalAmount: '1000.',
      schedule: linear,
      amuletCids: [],
    })
    expect((cmd.ExerciseCommand.choiceArgument as { totalAmount: string }).totalAmount).toBe('1000')
    expect(
      buildWithdrawCommand('TID', 'cid', '100.', ctx).ExerciseCommand.choiceArgument.withdrawAmount,
    ).toBe('100')
    expect(
      buildClaimResidualCommand('TID', 'rcid', '50.', ctx).ExerciseCommand.choiceArgument
        .withdrawAmount,
    ).toBe('50')
  })

  it('rejects a malformed amount rather than sending it to the ledger', () => {
    expect(() => buildWithdrawCommand('TID', 'cid', 'not-a-number', ctx)).toThrow()
  })
})
