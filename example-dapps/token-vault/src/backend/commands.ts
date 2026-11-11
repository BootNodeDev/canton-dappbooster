import type { Instrument } from '@/backend/deployment'
import type { LedgerCommand } from '@/backend/wallet'
import { canonicalAmount } from '@/utils/amount'

export type RequestKind = 'deposit' | 'withdraw'

// Carried verbatim out of the request's view, because `*_Settle` compares both field for field.
export type AllocationSpec = {
  settlement: unknown
  transferLeg: unknown
  transferLegId: string
}

export const PROPOSAL_ENTITY: Record<RequestKind, string> = {
  deposit: 'Canton.TokenVault.DepositProposal:DepositProposal',
  withdraw: 'Canton.TokenVault.WithdrawProposal:WithdrawProposal',
}

const CANCEL_CHOICE: Record<RequestKind, string> = {
  deposit: 'DepositProposal_Cancel',
  withdraw: 'WithdrawProposal_Cancel',
}

// An interface id, the one id a command names by package name: no upgrade resolves it.
const ALLOCATION_FACTORY =
  '#splice-api-token-allocation-instruction-v1:Splice.Api.Token.AllocationInstructionV1:AllocationFactory'

const EMPTY_EXTRA_ARGS = { context: { values: {} }, meta: { values: {} } }

const exercise = (
  templateId: string,
  contractId: string,
  choice: string,
  choiceArgument: Record<string, unknown>,
): LedgerCommand => ({ ExerciseCommand: { templateId, contractId, choice, choiceArgument } })

export const buildTapCommand = ({
  amount,
  instrument,
  user,
}: {
  amount: string
  instrument: Instrument
  user: string
}): LedgerCommand =>
  exercise(instrument.config.templateId, instrument.config.contractId, 'InstrumentConfig_Tap', {
    user,
    amount: canonicalAmount(amount),
  })

export const buildProposalCommand = ({
  amount,
  depositor,
  kind,
  vault,
  vaultPkg,
}: {
  amount: string
  depositor: string
  kind: RequestKind
  vault: string
  vaultPkg: string
}): LedgerCommand => ({
  CreateCommand: {
    createArguments: { amount: canonicalAmount(amount), depositor, vault },
    templateId: `${vaultPkg}:${PROPOSAL_ENTITY[kind]}`,
  },
})

export const buildCancelProposalCommand = ({
  kind,
  proposalCid,
  vaultPkg,
}: {
  kind: RequestKind
  proposalCid: string
  vaultPkg: string
}): LedgerCommand =>
  exercise(`${vaultPkg}:${PROPOSAL_ENTITY[kind]}`, proposalCid, CANCEL_CHOICE[kind], {})

export const buildAllocateCommand = ({
  inputHoldingCids,
  instrument,
  requestedAt,
  spec,
}: {
  inputHoldingCids: readonly string[]
  instrument: Instrument
  requestedAt: string
  spec: AllocationSpec
}): LedgerCommand =>
  exercise(ALLOCATION_FACTORY, instrument.config.contractId, 'AllocationFactory_Allocate', {
    allocation: spec,
    expectedAdmin: instrument.admin,
    extraArgs: EMPTY_EXTRA_ARGS,
    inputHoldingCids: [...inputHoldingCids],
    requestedAt,
  })
