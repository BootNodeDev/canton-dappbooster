import { canonicalAmount } from '#server/domain/amount'
import type { VestingSchedule } from '#server/domain/types'
import type { AppTransferContext } from '#server/ledger/transferContext'

// ── Curve variant encoding ────────────────────────────────────────────────────

// Daml-LF JSON: a variant is `{tag, value}`, a tuple `{_1, _2}`, a Decimal a string.
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

export const decodeSchedule = (raw: unknown): VestingSchedule => {
  // The ledger's own payload, typed by the Daml model, so it is cast rather than re-checked.
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

// No transfer context: this choice moves no Amulet, it only names the holdings Accept will lock.
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

// sender, provider and receiver are all the owner, so the owner alone signs the split.
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
    // Empty maps: only reward and validator-right inputs need them, and every input is an Amulet.
    context: {
      openMiningRound: args.openMiningRound,
      issuingMiningRounds: [],
      validatorRights: [],
      featuredAppRight: null,
    },
    // Not optional in practice: `checkExpectedDso` aborts when it is absent.
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
