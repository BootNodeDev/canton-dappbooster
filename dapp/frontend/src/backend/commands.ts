// JSON-Ledger-API v2 command builders and the one curve encode/decode pair. No I/O, so it is
// unit-tested directly in commands.test.ts.

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
  configCid: string
  note?: string
  proposer: string
  receiver: string
  schedule: VestingSchedule
  tokenCids: string[]
  totalAmount: string
}

const exercise = (
  templateId: string,
  contractId: string,
  choice: string,
  choiceArgument: Record<string, unknown>,
) => ({ ExerciseCommand: { templateId, contractId, choice, choiceArgument } })

// `tokenCids` are the funder's inputs, which the choice splits down to the grant; the holding the
// proposal ends up naming is the exact-size output that split leaves behind.
export const buildCreateVestingCommand = (
  templateId: string,
  factoryCid: string,
  args: CreateVestingArgs,
) =>
  exercise(templateId, factoryCid, 'VestingFactory_CreateVesting', {
    proposer: args.proposer,
    receiver: args.receiver,
    totalAmount: canonicalAmount(args.totalAmount),
    schedule: encodeSchedule(args.schedule),
    tokenCids: args.tokenCids,
    configCid: args.configCid,
    note: args.note ?? null,
  })

export const buildAcceptCommand = (templateId: string, pendingCid: string, configCid: string) =>
  exercise(templateId, pendingCid, 'VestingProposal_Accept', { configCid })

// Neither exit takes the config: both choices are bodyless and move no holding, so a proposal is
// archived on its controller's authority alone.
export const buildCancelProposalCommand = (templateId: string, pendingCid: string) =>
  exercise(templateId, pendingCid, 'VestingProposal_Cancel', {})

export const buildRejectProposalCommand = (templateId: string, pendingCid: string) =>
  exercise(templateId, pendingCid, 'VestingProposal_Reject', {})

// No nowMicros: the choice reads on-ledger getTime.
export const buildWithdrawCommand = (
  templateId: string,
  contractCid: string,
  withdrawAmount: string,
  configCid: string,
) =>
  exercise(templateId, contractCid, 'VestingContract_Withdraw', {
    withdrawAmount: canonicalAmount(withdrawAmount),
    configCid,
  })

export const buildCancelCommand = (templateId: string, contractCid: string, configCid: string) =>
  exercise(templateId, contractCid, 'VestingContract_Cancel', { configCid })

export const buildClaimResidualCommand = (
  templateId: string,
  claimCid: string,
  withdrawAmount: string,
  configCid: string,
) =>
  exercise(templateId, claimCid, 'VestedClaim_Withdraw', {
    withdrawAmount: canonicalAmount(withdrawAmount),
    configCid,
  })

// One fixed amount, so a tap is a menu item and not a form. The registry publishes an instrument's
// id, name, symbol and decimals but never its faucet, and the config is admin-signed with no
// payload in its disclosure, so the per-tap cap cannot be read from the app. This must stay at or
// under the `maxPerTap` scripts/bootstrap-vesting.mjs sets; above it, InstrumentConfig_Tap aborts
// and the message surfaces in the caller's toast.
export const TAP_AMOUNT = '1000'

// Nonconsuming on the admin-signed config, so a connected wallet taps with nothing disclosed but
// the config itself.
export const buildTapCommand = (
  templateId: string,
  configCid: string,
  args: { amount: string; user: string },
) =>
  exercise(templateId, configCid, 'InstrumentConfig_Tap', {
    user: args.user,
    amount: canonicalAmount(args.amount),
  })
