import { describe, expect, it, vi } from 'vitest'
import type { Deployment } from '@/backend/deployment'
import { LedgerBackend } from '@/backend/LedgerBackend'
import type { VaultProposal, VaultRequest } from '@/backend/requests'
import type { WalletFns } from '@/backend/wallet'

const VAULT = 'vault-operator::ns'
const ISSUER = 'token-issuer::ns'
const PARTY = 'nando::ns'
const CONFIG = 'forgepkg:Canton.TokenForge.Registry:InstrumentConfig'

const deployment: Deployment = {
  share: {
    admin: VAULT,
    config: { contractId: '00share', createdEventBlob: 'c2hhcmU=', templateId: CONFIG },
    id: 'VSH',
    maxPerTap: undefined,
    name: 'Vault Share',
    symbol: 'VSH',
  },
  synchronizerId: 'global-domain::1',
  underlying: {
    admin: ISSUER,
    config: {
      contractId: '00under',
      createdEventBlob: 'dW5kZXI=',
      synchronizerId: 'global-domain::1',
      templateId: CONFIG,
    },
    id: 'USDX',
    maxPerTap: '1000.0000000000',
    name: 'US Dollar X',
    symbol: 'USDX',
  },
  vault: VAULT,
  vaultCid: '00vault',
  vaultPkg: 'vaultpkg',
}

const holdingRow = (
  contractId: string,
  amount: string,
  instrumentId = { admin: ISSUER, id: 'USDX' },
) => ({
  contractEntry: {
    JsActiveContract: {
      createdEvent: {
        contractId,
        interfaceViews: [{ viewValue: { amount, instrumentId, lock: null, owner: PARTY } }],
      },
    },
  },
})

const wallet = (rows: unknown[] = []) => {
  const execute = vi.fn<WalletFns['execute']>(async () => undefined)
  const ledgerApi = vi.fn<WalletFns['ledgerApi']>(async (params) =>
    params.resource === '/v2/state/ledger-end' ? { offset: 42 } : rows,
  )
  return { execute, ledgerApi, sent: () => execute.mock.calls[0]?.[0] }
}

const request: VaultRequest = {
  allocateBefore: '2026-09-10T13:00:00Z',
  allocated: false,
  amount: '25.0',
  contractId: '00req',
  instrumentId: { admin: ISSUER, id: 'USDX' },
  kind: 'deposit',
  requestedAt: '2026-09-10T12:00:00Z',
  settleBefore: '2026-09-10T14:00:00Z',
  spec: {
    settlement: { settlementRef: { id: 'dep-1' } },
    transferLeg: { amount: '25.0' },
    transferLegId: 'deposit',
  },
}

describe('LedgerBackend.tap', () => {
  it('taps the faucet cap as the acting party, with the config disclosed and the synchronizer named', async () => {
    const fns = wallet()

    await new LedgerBackend(deployment, fns).tap(PARTY)

    expect(fns.execute).toHaveBeenCalledWith({
      actAs: [PARTY],
      readAs: [PARTY],
      commands: [
        {
          ExerciseCommand: {
            choice: 'InstrumentConfig_Tap',
            choiceArgument: { amount: '1000', user: PARTY },
            contractId: '00under',
            templateId: CONFIG,
          },
        },
      ],
      disclosedContracts: [deployment.underlying.config],
      synchronizerId: 'global-domain::1',
    })
  })

  it('names no synchronizer where the deployment carries none', async () => {
    const fns = wallet()
    const { synchronizerId: _unused, ...noSync } = deployment

    await new LedgerBackend(noSync, fns).tap(PARTY)

    expect(fns.sent()).not.toHaveProperty('synchronizerId')
  })

  it('refuses an instrument with no faucet before the wallet prompts', async () => {
    const fns = wallet()
    const noFaucet = {
      ...deployment,
      underlying: { ...deployment.underlying, maxPerTap: undefined },
    }

    await expect(new LedgerBackend(noFaucet, fns).tap(PARTY)).rejects.toThrow('USDX has no faucet')
    expect(fns.execute).not.toHaveBeenCalled()
  })
})

describe('LedgerBackend.holdingsOf', () => {
  it('reads the party it is given rather than the connected one', async () => {
    const fns = wallet()

    await new LedgerBackend(deployment, fns).holdingsOf(VAULT)

    const parties = fns.ledgerApi.mock.calls.flatMap(([params]) =>
      Object.keys(
        (params.body as { eventFormat?: { filtersByParty?: object } } | undefined)?.eventFormat
          ?.filtersByParty ?? {},
      ),
    )
    expect(parties).toEqual([VAULT])
  })
})

describe('LedgerBackend.propose', () => {
  it('creates a deposit proposal with nothing disclosed, the depositor its only signatory', async () => {
    const fns = wallet()

    await new LedgerBackend(deployment, fns).propose(PARTY, 'deposit', '25')

    expect(fns.sent()).toMatchObject({
      actAs: [PARTY],
      commands: [
        {
          CreateCommand: {
            createArguments: { amount: '25', depositor: PARTY, vault: VAULT },
            templateId: 'vaultpkg:Canton.TokenVault.DepositProposal:DepositProposal',
          },
        },
      ],
      disclosedContracts: [],
    })
  })

  it('creates a withdraw proposal under its own template', async () => {
    const fns = wallet()

    await new LedgerBackend(deployment, fns).propose(PARTY, 'withdraw', '15')

    expect(fns.sent()?.commands[0]).toEqual({
      CreateCommand: {
        createArguments: { amount: '15', depositor: PARTY, vault: VAULT },
        templateId: 'vaultpkg:Canton.TokenVault.WithdrawProposal:WithdrawProposal',
      },
    })
  })
})

describe('LedgerBackend.cancelProposal', () => {
  it('exercises the cancel the depositor controls', async () => {
    const fns = wallet()
    const proposal: VaultProposal = { amount: '10.0', contractId: '00prop', kind: 'deposit' }

    await new LedgerBackend(deployment, fns).cancelProposal(PARTY, proposal)

    expect(fns.sent()?.commands[0]).toEqual({
      ExerciseCommand: {
        choice: 'DepositProposal_Cancel',
        choiceArgument: {},
        contractId: '00prop',
        templateId: 'vaultpkg:Canton.TokenVault.DepositProposal:DepositProposal',
      },
    })
  })
})

describe('LedgerBackend.allocate', () => {
  it('funds the leg from the holdings it reads, at the request time, with the config disclosed', async () => {
    const fns = wallet([holdingRow('00hold', '30.0')])

    await new LedgerBackend(deployment, fns).allocate(PARTY, request)

    expect(fns.sent()?.commands[0]).toEqual({
      ExerciseCommand: {
        choice: 'AllocationFactory_Allocate',
        choiceArgument: {
          allocation: request.spec,
          expectedAdmin: ISSUER,
          extraArgs: { context: { values: {} }, meta: { values: {} } },
          inputHoldingCids: ['00hold'],
          requestedAt: '2026-09-10T12:00:00Z',
        },
        contractId: '00under',
        templateId:
          '#splice-api-token-allocation-instruction-v1:Splice.Api.Token.AllocationInstructionV1:AllocationFactory',
      },
    })
    expect(fns.sent()?.disclosedContracts).toEqual([deployment.underlying.config])
  })

  it('funds a share leg against the share instrument, with the share config disclosed', async () => {
    const shareRequest: VaultRequest = {
      ...request,
      amount: '15.0',
      instrumentId: { admin: VAULT, id: 'VSH' },
      kind: 'withdraw',
      spec: { ...request.spec, transferLegId: 'withdraw-shares-in' },
    }
    const fns = wallet([holdingRow('00vsh', '20.0', { admin: VAULT, id: 'VSH' })])

    await new LedgerBackend(deployment, fns).allocate(PARTY, shareRequest)

    expect(fns.sent()?.commands[0]).toMatchObject({
      ExerciseCommand: {
        choiceArgument: { expectedAdmin: VAULT, inputHoldingCids: ['00vsh'] },
        contractId: '00share',
      },
    })
    expect(fns.sent()?.disclosedContracts).toEqual([deployment.share.config])
  })

  it('refuses an instrument this vault does not name', async () => {
    const foreign: VaultRequest = { ...request, instrumentId: { admin: 'someone::ns', id: 'FAKE' } }

    await expect(new LedgerBackend(deployment, wallet()).allocate(PARTY, foreign)).rejects.toThrow(
      'does not name an instrument FAKE',
    )
  })

  it('refuses before the wallet prompts when the holdings fall short', async () => {
    const fns = wallet([holdingRow('00hold', '1.0')])

    await expect(new LedgerBackend(deployment, fns).allocate(PARTY, request)).rejects.toThrow(
      'not enough USDX',
    )
    expect(fns.execute).not.toHaveBeenCalled()
  })
})
