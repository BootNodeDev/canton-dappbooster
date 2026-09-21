import { type Choice, type ContractId, emptyMap } from '@daml/types'
import { AmuletVesting } from '@daml.js/amulet-vesting-0.0.2'
import { Splice } from '@daml.js/splice-amulet-0.1.22'
import type { AppTransferContext } from '@/backend/transferContext'
import type { LedgerCommand } from '@/backend/wallet'
import { canonicalAmount } from '@/utils/amount'
import type { VestingSchedule } from '@/utils/schedule'

const { AmuletVestedClaim, AmuletVestingContract, AmuletVestingFactory, AmuletVestingProposal } =
  AmuletVesting
const { AmuletRules } = Splice.AmuletRules

export type AmuletId = ContractId<Splice.Amulet.Amulet>
type OpenRoundId = ContractId<Splice.Round.OpenMiningRound>
type EncodedSchedule = AmuletVesting.Schedule.VestingSchedule

// ── Curve conversion ─────────────────────────────────────────────────────────

export const encodeSchedule = (schedule: VestingSchedule): EncodedSchedule => {
  const curve = schedule.curve
  if (curve.kind === 'linear') {
    return {
      cliff: schedule.cliff,
      curve: { tag: 'LinearVesting', value: { start: curve.start, end: curve.end } },
    }
  }
  return {
    cliff: schedule.cliff,
    curve: {
      tag: 'MilestoneVesting',
      value: {
        points: curve.points.map((point) => ({ _1: point.time, _2: String(point.fraction) })),
      },
    },
  }
}

export const decodeSchedule = (schedule: EncodedSchedule): VestingSchedule => {
  const curve = schedule.curve
  if (curve.tag === 'MilestoneVesting') {
    return {
      cliff: schedule.cliff,
      curve: {
        kind: 'milestone',
        points: curve.value.points.map((point) => ({ time: point._1, fraction: Number(point._2) })),
      },
    }
  }
  return {
    cliff: schedule.cliff,
    curve: { kind: 'linear', start: curve.value.start, end: curve.value.end },
  }
}

// ── Command builders ────────────────────────────────────────────────────────

const exercise = <T extends object, C, R, K>(
  templateId: string,
  contractId: string,
  choice: Choice<T, C, R, K>,
  argument: C,
): LedgerCommand => ({
  ExerciseCommand: {
    templateId,
    contractId,
    choice: choice.choiceName,
    // A choice argument is always a record; argumentEncode types its output as unknown.
    choiceArgument: choice.argumentEncode(argument) as Record<string, unknown>,
  },
})

// The only choice taking no transfer context: it moves no Amulet, only names what Accept will lock.
export const buildCreateVestingCommand = (
  templateId: string,
  factoryCid: string,
  args: {
    amuletCids: AmuletId[]
    note?: string
    proposer: string
    receiver: string
    schedule: VestingSchedule
    totalAmount: string
  },
) =>
  exercise(templateId, factoryCid, AmuletVestingFactory.AmuletVestingFactory_CreateVesting, {
    proposer: args.proposer,
    receiver: args.receiver,
    totalAmount: canonicalAmount(args.totalAmount),
    schedule: encodeSchedule(args.schedule),
    amuletCids: args.amuletCids,
    note: args.note ?? null,
  })

// Sender, provider and receiver are all the funder, which keeps this a one-signature submission.
export const buildSplitCommand = (
  templateId: string,
  amuletRulesCid: string,
  args: {
    amount: string
    amuletCids: AmuletId[]
    dso: string
    openMiningRound: OpenRoundId
    owner: string
  },
) =>
  exercise(templateId, amuletRulesCid, AmuletRules.AmuletRules_Transfer, {
    transfer: {
      sender: args.owner,
      provider: args.owner,
      inputs: args.amuletCids.map(
        (contractId): Splice.AmuletRules.TransferInput => ({
          tag: 'InputAmulet',
          value: contractId,
        }),
      ),
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
    context: {
      openMiningRound: args.openMiningRound,
      // Empty because an Amulet is the only input kind; rewards and rights need the other two.
      issuingMiningRounds: emptyMap<
        Splice.Types.Round,
        ContractId<Splice.Round.IssuingMiningRound>
      >(),
      validatorRights: emptyMap<string, ContractId<Splice.Amulet.ValidatorRight>>(),
      featuredAppRight: null,
    },
    // Optional in the type only: checkExpectedDso aborts when it is absent.
    expectedDso: args.dso,
  })

// One fixed amount, so a tap is a button and not a form.
export const TAP_AMOUNT = '100'

// LocalNet and devnet only: the DSO does not carry this choice on a real network.
export const buildTapCommand = (
  templateId: string,
  amuletRulesCid: string,
  args: { openMiningRound: OpenRoundId; receiver: string },
) =>
  exercise(templateId, amuletRulesCid, AmuletRules.AmuletRules_DevNet_Tap, {
    receiver: args.receiver,
    amount: TAP_AMOUNT,
    openRound: args.openMiningRound,
  })

export const buildAcceptCommand = (
  templateId: string,
  pendingCid: string,
  ctx: AppTransferContext,
) => exercise(templateId, pendingCid, AmuletVestingProposal.AmuletVestingProposal_Accept, { ctx })

// No nowMicros: the choice reads on-ledger getTime.
export const buildWithdrawCommand = (
  templateId: string,
  contractCid: string,
  withdrawAmount: string,
  ctx: AppTransferContext,
) =>
  exercise(templateId, contractCid, AmuletVestingContract.AmuletVestingContract_Withdraw, {
    withdrawAmount: canonicalAmount(withdrawAmount),
    ctx,
  })

export const buildCancelCommand = (
  templateId: string,
  contractCid: string,
  ctx: AppTransferContext,
) => exercise(templateId, contractCid, AmuletVestingContract.AmuletVestingContract_Cancel, { ctx })

export const buildClaimResidualCommand = (
  templateId: string,
  claimCid: string,
  withdrawAmount: string,
  ctx: AppTransferContext,
) =>
  exercise(templateId, claimCid, AmuletVestedClaim.AmuletVestedClaim_Withdraw, {
    withdrawAmount: canonicalAmount(withdrawAmount),
    ctx,
  })
