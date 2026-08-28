// JSON-Ledger-API v2 command builders and the one curve encode/decode pair. No I/O, so it is
// unit-tested directly in commands.test.ts.

import type { AppTransferContext } from '@/backend/transferContext'
import { canonicalAmount } from '@/utils/amount'
import type { VestingSchedule } from '@/utils/schedule'

// ── Curve variant encoding ────────────────────────────────────────────────────
// The one place the JSON-LF convention lives, mirrored by decodeSchedule: a variant is
// `{tag, value}`, a `(Time, Decimal)` tuple `{_1, _2}`, Time an ISO-8601 string and Decimal a
// string.

type EncodedCurve =
  | { tag: 'LinearVesting'; value: { end: string; start: string } }
  | { tag: 'MilestoneVesting'; value: { points: { _1: string; _2: string }[] } }

export type EncodedSchedule = { cliff: string; curve: EncodedCurve }

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
  amuletCids: string[]
  note?: string
  proposer: string
  receiver: string
  schedule: VestingSchedule
  totalAmount: string
}

const exercise = (
  templateId: string,
  contractId: string,
  choice: string,
  choiceArgument: Record<string, unknown>,
) => ({ ExerciseCommand: { templateId, contractId, choice, choiceArgument } })

// The only choice taking no transfer context: it moves no Amulet, it only records which of the
// funder's holdings the eventual Accept will lock.
export const buildCreateVestingCommand = (
  templateId: string,
  factoryCid: string,
  args: CreateVestingArgs,
) =>
  exercise(templateId, factoryCid, 'AmuletVestingFactory_CreateVesting', {
    proposer: args.proposer,
    receiver: args.receiver,
    totalAmount: canonicalAmount(args.totalAmount),
    schedule: encodeSchedule(args.schedule),
    amuletCids: args.amuletCids,
    note: args.note ?? null,
  })

// The funder self-transfers `amount` out of its own holdings, so the grant can name an Amulet
// nothing else has pledged. sender, provider and receiver are all the funder, which is what makes
// the funder the only controller and keeps this a one-signature submission. Splice values an input
// at its full `initialAmount` — the holding fee is charged only by `Amulet_Expire` — so an exact
// split leaves the eventual Accept exactly covered, with no headroom to guess at.
export const buildSplitCommand = (
  templateId: string,
  amuletRulesCid: string,
  args: {
    amount: string
    amuletCids: string[]
    dso: string
    openMiningRound: string
    owner: string
  },
) =>
  exercise(templateId, amuletRulesCid, 'AmuletRules_Transfer', {
    transfer: {
      sender: args.owner,
      provider: args.owner,
      inputs: args.amuletCids.map((contractId) => ({ tag: 'InputAmulet', value: contractId })),
      outputs: [
        {
          receiver: args.owner,
          receiverFeeRatio: '0.0',
          amount: canonicalAmount(args.amount),
          lock: null,
          meta: null,
        },
      ],
      beneficiaries: null,
    },
    // Both maps are empty because the only input kind here is an Amulet; rewards and validator
    // rights are what the other kinds need. `expectedDso` is not optional in practice:
    // `checkExpectedDso` aborts when it is absent.
    context: {
      openMiningRound: args.openMiningRound,
      issuingMiningRounds: [],
      validatorRights: [],
      featuredAppRight: null,
    },
    expectedDso: args.dso,
  })

export const buildAcceptCommand = (
  templateId: string,
  pendingCid: string,
  ctx: AppTransferContext,
) => exercise(templateId, pendingCid, 'AmuletVestingProposal_Accept', { ctx })

// No nowMicros: the choice reads on-ledger getTime.
export const buildWithdrawCommand = (
  templateId: string,
  contractCid: string,
  withdrawAmount: string,
  ctx: AppTransferContext,
) =>
  exercise(templateId, contractCid, 'AmuletVestingContract_Withdraw', {
    withdrawAmount: canonicalAmount(withdrawAmount),
    ctx,
  })

export const buildCancelCommand = (
  templateId: string,
  contractCid: string,
  ctx: AppTransferContext,
) => exercise(templateId, contractCid, 'AmuletVestingContract_Cancel', { ctx })

export const buildClaimResidualCommand = (
  templateId: string,
  claimCid: string,
  withdrawAmount: string,
  ctx: AppTransferContext,
) =>
  exercise(templateId, claimCid, 'AmuletVestedClaim_Withdraw', {
    withdrawAmount: canonicalAmount(withdrawAmount),
    ctx,
  })
