// JSON-Ledger-API v2 command builders + explicit-disclosure shaping + the single
// curve encode/decode pair. No I/O — unit-tested in commands.test.ts. Salvaged from
// dapp/frontend's vesting.ts and adapted to the upgraded vest-lite domain:
//   - claim drops nowMicros (the contract reads on-ledger getTime),
//   - the schedule carries a VestingCurve variant + ISO cliff,
//   - adds cancel (Contract_Cancel) and residual withdraw (Claim_Withdraw).

import type { VestingSchedule } from '@/lib/schedule'

export type DisclosedRef = {
  contractId: string
  createdEventBlob: string
  synchronizerId?: string
}

type AcsRow = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: { contractId?: string; createdEventBlob?: string }
      synchronizerId?: string
    }
  }
}

// Pull the disclosure payload out of a JSON-Ledger-API v2 active-contracts row
// (requires the read to set includeCreatedEventBlob: true).
export const extractCreatedEventBlob = (row: AcsRow): DisclosedRef | undefined => {
  const active = row.contractEntry?.JsActiveContract
  const event = active?.createdEvent
  if (event?.contractId === undefined || event.createdEventBlob === undefined) {
    return undefined
  }
  return {
    contractId: event.contractId,
    createdEventBlob: event.createdEventBlob,
    synchronizerId: active?.synchronizerId,
  }
}

export const buildDisclosedContract = (templateId: string, ref: DisclosedRef) => ({
  templateId,
  contractId: ref.contractId,
  createdEventBlob: ref.createdEventBlob,
  ...(ref.synchronizerId === undefined ? {} : { synchronizerId: ref.synchronizerId }),
})

// ── Curve variant encoding ────────────────────────────────────────────────────
// THE ONE GENUINE UNKNOWN. The Daml JSON Ledger API v2 encodes a DAML variant as
// `{ "tag": "<Constructor>", "value": <fields-record> }`, a tuple `(Time, Decimal)`
// as a record `{ "_1": <time>, "_2": <decimal> }`, Time as an ISO-8601 string, and
// Decimal as a string. This is the single place that convention lives; decode is
// its mirror (decodeSchedule below).
// VERIFY: curve encoding to be round-trip-confirmed in Phase 6 smoke.

type EncodedCurve =
  | { tag: 'LinearVesting'; value: { start: string; end: string } }
  | { tag: 'MilestoneVesting'; value: { points: { _1: string; _2: string }[] } }

export type EncodedSchedule = { curve: EncodedCurve; cliff: string }

export const encodeSchedule = (schedule: VestingSchedule): EncodedSchedule => {
  const curve = schedule.curve
  if (curve.kind === 'linear') {
    return {
      curve: { tag: 'LinearVesting', value: { start: curve.start, end: curve.end } },
      cliff: schedule.cliff,
    }
  }
  return {
    curve: {
      tag: 'MilestoneVesting',
      value: {
        points: curve.points.map((point) => ({ _1: point.time, _2: String(point.fraction) })),
      },
    },
    cliff: schedule.cliff,
  }
}

// Mirror of encodeSchedule: parse the JSON-LF variant back into the UI's
// VestingSchedule. Tolerant of a missing/garbled payload (returns a degenerate
// but well-typed schedule rather than throwing inside a mapper).
export const decodeSchedule = (raw: unknown): VestingSchedule => {
  const record = (raw ?? {}) as { curve?: unknown; cliff?: unknown }
  const cliff = typeof record.cliff === 'string' ? record.cliff : ''
  const curve = (record.curve ?? {}) as { tag?: unknown; value?: unknown }
  if (curve.tag === 'MilestoneVesting') {
    const value = (curve.value ?? {}) as { points?: unknown }
    const points = Array.isArray(value.points) ? value.points : []
    return {
      cliff,
      curve: {
        kind: 'milestone',
        points: points.map((point) => {
          const tuple = (point ?? {}) as { _1?: unknown; _2?: unknown }
          return { time: String(tuple._1 ?? ''), fraction: Number(tuple._2 ?? 0) }
        }),
      },
    }
  }
  const value = (curve.value ?? {}) as { start?: unknown; end?: unknown }
  return {
    cliff,
    curve: {
      kind: 'linear',
      start: typeof value.start === 'string' ? value.start : '',
      end: typeof value.end === 'string' ? value.end : '',
    },
  }
}

// ── Command builders ────────────────────────────────────────────────────────

type CreateVestingArgs = {
  proposer: string
  beneficiary: string
  total: number
  schedule: VestingSchedule
  note?: string
}

export const buildCreateVestingCommand = (
  templateId: string,
  factoryCid: string,
  args: CreateVestingArgs,
) => ({
  ExerciseCommand: {
    templateId,
    contractId: factoryCid,
    choice: 'Factory_CreateVesting',
    choiceArgument: {
      proposer: args.proposer,
      beneficiary: args.beneficiary,
      total: String(args.total),
      schedule: encodeSchedule(args.schedule),
      note: args.note ?? null,
    },
  },
})

export const buildAcceptCommand = (templateId: string, proposalCid: string) => ({
  ExerciseCommand: {
    templateId,
    contractId: proposalCid,
    choice: 'Proposal_Accept',
    choiceArgument: {},
  },
})

// No nowMicros: VestingContract.Contract_Claim reads on-ledger getTime.
export const buildClaimCommand = (templateId: string, contractCid: string, amount: number) => ({
  ExerciseCommand: {
    templateId,
    contractId: contractCid,
    choice: 'Contract_Claim',
    choiceArgument: { amount: String(amount) },
  },
})

export const buildCancelCommand = (templateId: string, contractCid: string) => ({
  ExerciseCommand: {
    templateId,
    contractId: contractCid,
    choice: 'Contract_Cancel',
    choiceArgument: {},
  },
})

export const buildClaimResidualCommand = (
  templateId: string,
  claimCid: string,
  withdrawAmount: number,
) => ({
  ExerciseCommand: {
    templateId,
    contractId: claimCid,
    choice: 'Claim_Withdraw',
    choiceArgument: { withdrawAmount: String(withdrawAmount) },
  },
})
