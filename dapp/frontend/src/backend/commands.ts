// JSON-Ledger-API v2 command builders, explicit-disclosure shaping, and the one curve
// encode/decode pair. No I/O, so it is unit-tested directly in commands.test.ts.

import { canonicalAmount } from '@/lib/amount'
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
// The one place the JSON-LF convention lives, mirrored by decodeSchedule: a variant is
// `{tag, value}`, a `(Time, Decimal)` tuple `{_1, _2}`, Time an ISO-8601 string and Decimal a
// string. Unconfirmed against a real ledger: only the mock exercises it so far.

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

// Mirror of encodeSchedule. A missing or garbled payload yields a degenerate but well-typed
// schedule rather than throwing inside a mapper.
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
  total: string
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
      total: canonicalAmount(args.total),
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
export const buildClaimCommand = (templateId: string, contractCid: string, amount: string) => ({
  ExerciseCommand: {
    templateId,
    contractId: contractCid,
    choice: 'Contract_Claim',
    choiceArgument: { amount: canonicalAmount(amount) },
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
  withdrawAmount: string,
) => ({
  ExerciseCommand: {
    templateId,
    contractId: claimCid,
    choice: 'Claim_Withdraw',
    choiceArgument: { withdrawAmount: canonicalAmount(withdrawAmount) },
  },
})
