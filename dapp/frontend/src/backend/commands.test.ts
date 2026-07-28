import { describe, expect, it } from 'vitest'
import type { VestingSchedule } from '@/lib/schedule'
import {
  buildAcceptCommand,
  buildCancelCommand,
  buildClaimCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
  buildDisclosedContract,
  decodeSchedule,
  encodeSchedule,
  extractCreatedEventBlob,
} from './commands'

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

describe('extractCreatedEventBlob', () => {
  it('pulls cid + blob + synchronizerId from an ACS row', () => {
    const row = {
      contractEntry: {
        JsActiveContract: {
          createdEvent: { contractId: 'cid1', createdEventBlob: 'BLOB' },
          synchronizerId: 'sync1',
        },
      },
    }
    expect(extractCreatedEventBlob(row)).toEqual({
      contractId: 'cid1',
      createdEventBlob: 'BLOB',
      synchronizerId: 'sync1',
    })
  })

  it('returns undefined when the blob is missing', () => {
    const row = { contractEntry: { JsActiveContract: { createdEvent: { contractId: 'c' } } } }
    expect(extractCreatedEventBlob(row)).toBeUndefined()
  })
})

describe('buildDisclosedContract', () => {
  it('shapes a disclosedContracts entry', () => {
    expect(
      buildDisclosedContract('TID', {
        contractId: 'c',
        createdEventBlob: 'b',
        synchronizerId: 's',
      }),
    ).toEqual({ templateId: 'TID', contractId: 'c', createdEventBlob: 'b', synchronizerId: 's' })
  })

  it('omits synchronizerId when absent', () => {
    expect(buildDisclosedContract('TID', { contractId: 'c', createdEventBlob: 'b' })).toEqual({
      templateId: 'TID',
      contractId: 'c',
      createdEventBlob: 'b',
    })
  })
})

describe('command builders', () => {
  it('buildCreateVestingCommand shapes Factory_CreateVesting args with the encoded schedule', () => {
    const cmd = buildCreateVestingCommand('TID', 'fcid', {
      proposer: 'P',
      beneficiary: 'B',
      total: 1000,
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
      total: 1,
      schedule: linear,
    })
    expect((cmd.ExerciseCommand.choiceArgument as { note: unknown }).note).toBeNull()
  })

  it('buildClaimCommand stringifies amount and carries no nowMicros (getTime)', () => {
    expect(buildClaimCommand('TID', 'cid', 100)).toEqual({
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

  it('buildClaimResidualCommand targets Claim_Withdraw and stringifies withdrawAmount', () => {
    expect(buildClaimResidualCommand('TID', 'rcid', 50)).toEqual({
      ExerciseCommand: {
        templateId: 'TID',
        contractId: 'rcid',
        choice: 'Claim_Withdraw',
        choiceArgument: { withdrawAmount: '50' },
      },
    })
  })
})
