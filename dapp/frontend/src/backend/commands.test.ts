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
} from '@/backend/commands'
import type { VestingSchedule } from '@/utils/schedule'

const CONFIG_CID = '00cfg'

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
  it('builds the factory choice with the canonical amount, encoded schedule and token ids', () => {
    expect(
      buildCreateVestingCommand('pkg:Vesting:VestingFactory', 'factory-cid', {
        proposer: 'funder::1',
        receiver: 'receiver::1',
        totalAmount: '1000',
        schedule: linear,
        tokenCids: ['t1', 't2'],
      }),
    ).toEqual({
      ExerciseCommand: {
        templateId: 'pkg:Vesting:VestingFactory',
        contractId: 'factory-cid',
        choice: 'VestingFactory_CreateVesting',
        choiceArgument: {
          proposer: 'funder::1',
          receiver: 'receiver::1',
          totalAmount: '1000',
          schedule: encodeSchedule(linear),
          tokenCids: ['t1', 't2'],
          note: null,
        },
      },
    })
  })

  it('builds Accept carrying nothing but the config', () => {
    expect(buildAcceptCommand('pkg:Vesting:VestingProposal', 'p1', CONFIG_CID)).toEqual({
      ExerciseCommand: {
        templateId: 'pkg:Vesting:VestingProposal',
        contractId: 'p1',
        choice: 'VestingProposal_Accept',
        choiceArgument: { configCid: CONFIG_CID },
      },
    })
  })

  it('builds Withdraw with a canonical amount beside the config', () => {
    expect(buildWithdrawCommand('pkg:Vesting:VestingContract', 'c1', '10.5', CONFIG_CID)).toEqual({
      ExerciseCommand: {
        templateId: 'pkg:Vesting:VestingContract',
        contractId: 'c1',
        choice: 'VestingContract_Withdraw',
        choiceArgument: { withdrawAmount: '10.5', configCid: CONFIG_CID },
      },
    })
  })

  it('builds Cancel with the config alone', () => {
    expect(buildCancelCommand('pkg:Vesting:VestingContract', 'c1', CONFIG_CID)).toEqual({
      ExerciseCommand: {
        templateId: 'pkg:Vesting:VestingContract',
        contractId: 'c1',
        choice: 'VestingContract_Cancel',
        choiceArgument: { configCid: CONFIG_CID },
      },
    })
  })

  it('builds the residual withdraw against the claim template', () => {
    expect(buildClaimResidualCommand('pkg:Vesting:VestedClaim', 'r1', '2', CONFIG_CID)).toEqual({
      ExerciseCommand: {
        templateId: 'pkg:Vesting:VestedClaim',
        contractId: 'r1',
        choice: 'VestedClaim_Withdraw',
        choiceArgument: { withdrawAmount: '2', configCid: CONFIG_CID },
      },
    })
  })

  // The faucet is exercised on the config itself, so it takes the resolved template id the
  // registry's disclosure carries rather than the package-name form a filter takes.
  it('builds the faucet tap against the resolved config template id', () => {
    expect(
      buildTapCommand('20d54824:Canton.TokenForge.Registry:InstrumentConfig', CONFIG_CID, {
        amount: '1000',
        user: 'funder::1',
      }),
    ).toEqual({
      ExerciseCommand: {
        templateId: '20d54824:Canton.TokenForge.Registry:InstrumentConfig',
        contractId: CONFIG_CID,
        choice: 'InstrumentConfig_Tap',
        choiceArgument: { user: 'funder::1', amount: '1000' },
      },
    })
  })

  it('canonicalizes the amount and refuses one it cannot parse', () => {
    expect(
      buildWithdrawCommand('pkg:Vesting:VestingContract', 'c1', '10.50', CONFIG_CID).ExerciseCommand
        .choiceArgument.withdrawAmount,
    ).toBe('10.5')
    expect(() =>
      buildWithdrawCommand('pkg:Vesting:VestingContract', 'c1', 'not-a-number', CONFIG_CID),
    ).toThrow()
  })
})
