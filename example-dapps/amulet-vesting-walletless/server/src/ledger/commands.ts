// JSON-Ledger-API v2 command builders and the one curve encode/decode pair. No I/O, so it is
// unit-tested directly in commands.test.ts.

import { canonicalAmount } from '#server/domain/amount'
import type { VestingSchedule } from '#server/domain/types'
import type { AppTransferContext } from '#server/ledger/transferContext'

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

// Mirror of encodeSchedule. The payload is the ledger's own, typed by the Daml model, so it is read
// as that shape rather than re-checked.
export const decodeSchedule = (raw: unknown): VestingSchedule => {
  const { cliff, curve } = raw as EncodedSchedule
  return curve.tag === 'MilestoneVesting'
    ? {
        cliff,
        curve: {
          kind: 'milestone',
          points: curve.value.points.map(({ _1, _2 }) => ({ time: _1, fraction: Number(_2) })),
        },
      }
    : { cliff, curve: { kind: 'linear', start: curve.value.start, end: curve.value.end } }
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

// One fixed amount, so a tap is a button and not a form.
export const TAP_AMOUNT = '100'

// LocalNet and devnet only: the DSO does not carry this choice on a real network.
export const buildTapCommand = (
  templateId: string,
  amuletRulesCid: string,
  args: { openMiningRound: string; receiver: string },
) =>
  exercise(templateId, amuletRulesCid, 'AmuletRules_DevNet_Tap', {
    receiver: args.receiver,
    amount: TAP_AMOUNT,
    openRound: args.openMiningRound,
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
