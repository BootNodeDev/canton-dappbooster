import { describe, expect, it } from 'vitest'
import {
  type AllocationSpec,
  buildAllocateCommand,
  buildCancelProposalCommand,
  buildProposalCommand,
  buildTapCommand,
} from '@/backend/commands'
import type { Instrument } from '@/backend/deployment'

const VAULT_PKG = 'vaultpkg'
const underlying: Instrument = {
  admin: 'token-issuer::ns',
  config: {
    contractId: '00cfg',
    createdEventBlob: 'YmxvYg==',
    templateId: 'forgepkg:Canton.TokenForge.Registry:InstrumentConfig',
  },
  id: 'USDX',
  maxPerTap: '1000.0000000000',
  name: 'US Dollar X',
  symbol: 'USDX',
}

describe('buildTapCommand', () => {
  it('exercises the faucet on the config under its own resolved template id', () => {
    expect(
      buildTapCommand({ amount: '1000.0000000000', instrument: underlying, user: 'nando::ns' }),
    ).toEqual({
      ExerciseCommand: {
        choice: 'InstrumentConfig_Tap',
        choiceArgument: { amount: '1000', user: 'nando::ns' },
        contractId: '00cfg',
        templateId: 'forgepkg:Canton.TokenForge.Registry:InstrumentConfig',
      },
    })
  })
})

describe('buildProposalCommand', () => {
  it('creates the deposit proposal, since the vault has no factory choice for one', () => {
    expect(
      buildProposalCommand({
        amount: '25',
        depositor: 'nando::ns',
        kind: 'deposit',
        vault: 'vault-operator::ns',
        vaultPkg: VAULT_PKG,
      }),
    ).toEqual({
      CreateCommand: {
        createArguments: { amount: '25', depositor: 'nando::ns', vault: 'vault-operator::ns' },
        templateId: 'vaultpkg:Canton.TokenVault.DepositProposal:DepositProposal',
      },
    })
  })

  it('changes only the template for a withdraw', () => {
    const args = {
      amount: '15',
      depositor: 'nando::ns',
      vault: 'vault-operator::ns',
      vaultPkg: VAULT_PKG,
    }
    const deposit = buildProposalCommand({ ...args, kind: 'deposit' })
    const withdraw = buildProposalCommand({ ...args, kind: 'withdraw' })

    expect('CreateCommand' in withdraw && withdraw.CreateCommand.templateId).toBe(
      'vaultpkg:Canton.TokenVault.WithdrawProposal:WithdrawProposal',
    )
    expect('CreateCommand' in deposit && deposit.CreateCommand.createArguments).toEqual(
      'CreateCommand' in withdraw && withdraw.CreateCommand.createArguments,
    )
  })

  it('sends the amount in the canonical form a Daml Numeric literal takes', () => {
    const command = buildProposalCommand({
      amount: '25.50',
      depositor: 'nando::ns',
      kind: 'deposit',
      vault: 'vault-operator::ns',
      vaultPkg: VAULT_PKG,
    })
    expect('CreateCommand' in command && command.CreateCommand.createArguments.amount).toBe('25.5')
  })

  it('refuses an amount that is not one', () => {
    expect(() =>
      buildProposalCommand({
        amount: 'lots',
        depositor: 'nando::ns',
        kind: 'deposit',
        vault: 'vault-operator::ns',
        vaultPkg: VAULT_PKG,
      }),
    ).toThrow(/Not a valid amount/)
  })
})

describe('buildCancelProposalCommand', () => {
  it.each([
    ['deposit', 'DepositProposal_Cancel', 'Canton.TokenVault.DepositProposal:DepositProposal'],
    ['withdraw', 'WithdrawProposal_Cancel', 'Canton.TokenVault.WithdrawProposal:WithdrawProposal'],
  ] as const)('names the %s template its own cancel, with no argument', (kind, choice, entity) => {
    expect(
      buildCancelProposalCommand({ kind, proposalCid: '00prop', vaultPkg: VAULT_PKG }),
    ).toEqual({
      ExerciseCommand: {
        choice,
        choiceArgument: {},
        contractId: '00prop',
        templateId: `vaultpkg:${entity}`,
      },
    })
  })
})

describe('buildAllocateCommand', () => {
  const spec: AllocationSpec = {
    settlement: { executor: 'vault-operator::ns', settlementRef: { cid: null, id: 'dep-1' } },
    transferLeg: { amount: '25.0', receiver: 'vault-operator::ns', sender: 'nando::ns' },
    transferLegId: 'deposit',
  }

  it('exercises the factory under the interface id, on the instrument config', () => {
    expect(
      buildAllocateCommand({
        inputHoldingCids: ['00hold'],
        instrument: underlying,
        requestedAt: '2026-09-10T12:00:00Z',
        spec,
      }),
    ).toEqual({
      ExerciseCommand: {
        choice: 'AllocationFactory_Allocate',
        choiceArgument: {
          allocation: spec,
          expectedAdmin: 'token-issuer::ns',
          extraArgs: { context: { values: {} }, meta: { values: {} } },
          inputHoldingCids: ['00hold'],
          requestedAt: '2026-09-10T12:00:00Z',
        },
        contractId: '00cfg',
        templateId:
          '#splice-api-token-allocation-instruction-v1:Splice.Api.Token.AllocationInstructionV1:AllocationFactory',
      },
    })
  })

  it('passes the very settlement and leg objects through, never a rebuilt copy', () => {
    const command = buildAllocateCommand({
      inputHoldingCids: [],
      instrument: underlying,
      requestedAt: '2026-09-10T12:00:00Z',
      spec,
    })
    const sent = 'ExerciseCommand' in command ? command.ExerciseCommand.choiceArgument : {}
    const allocation = sent.allocation as AllocationSpec

    expect(allocation.settlement).toBe(spec.settlement)
    expect(allocation.transferLeg).toBe(spec.transferLeg)
  })
})
