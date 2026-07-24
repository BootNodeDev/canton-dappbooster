import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { createRpc, errorData, errorMessage } from '../src/rpc.ts'
import type { JsonRpcResponse } from '../src/types.ts'

const baseConfig = () => ({
  port: 3010,
  corsOrigins: ['http://localhost:3011'],
  network: 'canton:local',
  provider: {
    id: 'wallet-service',
    version: '0.1.0',
    url: 'http://localhost:3010',
    userUrl: 'http://localhost:3010',
  },
  canton: {
    jsonApiUrl: 'http://localhost:3013',
    ledgerApiUrl: 'grpc://localhost:3014',
    adminApiUrl: 'grpc://localhost:3015',
    backendToken: undefined as string | undefined,
    tokenSource: 'none' as const,
  },
  splice: {
    validatorUrl: 'http://localhost:2000/api/validator',
    scanApiUrl: 'http://scan.localhost:4000/api/scan',
    registryApiUrl: 'http://localhost:2000/api/validator/v0/scan-proxy',
  },
})

const withToken = () => ({
  ...baseConfig(),
  canton: {
    ...baseConfig().canton,
    backendToken: 'backend.jwt',
    tokenSource: 'env' as const,
  },
})

describe('rpc dispatcher', () => {
  it('returns -32600 when jsonrpc is not "2.0"', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '1.0' as never,
      id: 1,
      method: 'status',
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32600)
  })

  it('returns -32600 when method is not a string', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 42 as never,
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32600)
  })

  it('returns -32601 for unknown methods', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'doesNotExist',
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32601)
  })

  it('returns -32004 for prepareExecute (carpincho signs)', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'prepareExecute',
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32004)
  })

  it('listAccounts returns []', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'listAccounts',
    })) as JsonRpcResponse
    assert.ok('result' in res)
    assert.deepEqual(res.result, [])
  })

  it('getActiveNetwork returns the configured network', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'getActiveNetwork',
    })) as JsonRpcResponse
    assert.ok('result' in res)
    assert.deepEqual(res.result, { networkId: 'canton:local' })
  })
})

describe('JSON-RPC notifications', () => {
  it('returns undefined for a notification (no id field)', async () => {
    const rpc = createRpc(baseConfig())
    const res = await rpc.handle({ jsonrpc: '2.0', method: 'disconnect' } as never)
    assert.equal(res, undefined)
  })

  it('returns a response for id: null (explicit, not a notification)', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: null,
      method: 'disconnect',
    })) as JsonRpcResponse
    assert.ok(res !== undefined)
    assert.ok('result' in res)
  })
})

describe('invalid params mapping', () => {
  it('returns -32602 when prepareTransaction is missing commands', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'prepareTransaction',
      params: { partyId: 'alice::fp' },
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32602)
  })

  it('returns -32602 when ledgerApi is missing resource', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'ledgerApi',
      params: { requestMethod: 'get' },
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32602)
  })
})

describe('party methods are off the dapp-api surface', () => {
  it('prepareCreateParty returns -32601 Method not found', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'prepareCreateParty',
      params: { publicKeyBase64: 'pk', partyHint: 'alice' },
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32601)
  })

  it('completeCreateParty returns -32601 Method not found', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'completeCreateParty',
      params: { onboardingId: 'x', signatureBase64: 'sig' },
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32601)
  })
})

describe('ledgerApi pass-through', () => {
  it('accepts requestMethod=get', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'ledgerApi',
      params: { requestMethod: 'get', resource: '/v2/version' },
    })) as JsonRpcResponse
    // Without a backend token + real SDK this fails at our token check, not at whitelist validation.
    // Assert: error is NOT -32602 (validation) and NOT a whitelist rejection.
    assert.ok('error' in res)
    assert.notEqual(res.error.code, -32602)
    assert.ok(!String(res.error.message).includes('Only POST'))
  })
})

describe('CIP-56 token helpers', () => {
  it('lists pending transfers through the SDK token namespace without reshaping contracts', async () => {
    // Scenario: wallet-service owns the Node-only wallet-sdk dependency, but
    // Carpincho should still see the SDK contract payload directly so future
    // browser-SDK migration does not need a second DTO translation.
    const pendingContracts = [
      {
        contractId: 'transfer-cid-1',
        interfaceViewValue: {
          transfer: {
            sender: 'sender::party',
            receiver: 'receiver::party',
            amount: '7.5',
            instrumentId: { admin: 'admin::party', id: 'Amulet' },
          },
        },
      },
    ]
    const seen: { partyId?: string; tokenConfig?: unknown; amuletConfig?: unknown } = {}
    const rpc = createRpc(withToken(), {
      sdkFactory: async (options) => {
        seen.tokenConfig = (options as { token?: unknown }).token
        seen.amuletConfig = (options as { amulet?: unknown }).amulet
        return {
          token: {
            transfer: {
              pending: async (partyId: string) => {
                seen.partyId = partyId
                return pendingContracts
              },
            },
          },
        }
      },
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.listPendingTransfers',
      params: { partyId: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, pendingContracts)
    assert.equal(seen.partyId, 'receiver::party')
    assert.deepEqual(seen.tokenConfig, {
      validatorUrl: 'http://localhost:2000/api/validator',
      auth: { method: 'static', token: 'backend.jwt' },
      registries: ['http://localhost:2000/api/validator/v0/scan-proxy'],
    })
    assert.deepEqual(seen.amuletConfig, {
      validatorUrl: 'http://localhost:2000/api/validator',
      scanApiUrl: 'http://scan.localhost:4000/api/scan',
      registryUrl: new URL('http://localhost:2000/api/validator/v0/scan-proxy'),
      auth: { method: 'static', token: 'backend.jwt' },
    })
  })

  it('prepares an accept-transfer command through the SDK token namespace', async () => {
    // Scenario: accepting a pending CIP-56 transfer requires SDK registry
    // context, but Carpincho must still sign the prepared transaction itself.
    // wallet-service returns the SDK command and disclosed contracts only.
    const disclosedContracts = [{ contractId: 'registry-context-cid', createdEventBlob: 'blob' }]
    const seen: { transferInstructionCid?: string; registryUrl?: string } = {}
    const rpc = createRpc(withToken(), {
      sdkFactory: async () => ({
        token: {
          transfer: {
            accept: async (params: { transferInstructionCid: string; registryUrl: URL }) => {
              seen.transferInstructionCid = params.transferInstructionCid
              seen.registryUrl = params.registryUrl.href
              return [{ ExerciseCommand: { choice: 'Accept' } }, disclosedContracts]
            },
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.acceptTransfer',
      params: { transferInstructionCid: 'transfer-cid-1' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, {
      commands: { ExerciseCommand: { choice: 'Accept' } },
      disclosedContracts,
    })
    assert.equal(seen.transferInstructionCid, 'transfer-cid-1')
    assert.equal(seen.registryUrl, 'http://localhost:2000/api/validator/v0/scan-proxy')
  })

  it('prepares a token transfer command through the SDK token namespace', async () => {
    // Scenario: sending CIP-56 tokens requires wallet-service to ask the
    // Node-only SDK for transfer commands, while Carpincho remains responsible
    // for signing the prepared transaction hash with the sender's local key.
    const disclosedContracts = [{ contractId: 'transfer-context-cid', createdEventBlob: 'blob' }]
    const expirationDate = '2026-06-10T15:00:00.000Z'
    const seen: { params?: Record<string, unknown> } = {}
    const rpc = createRpc(withToken(), {
      sdkFactory: async () => ({
        token: {
          transfer: {
            create: async (params: Record<string, unknown>) => {
              seen.params = params
              return [
                { ExerciseCommand: { choice: 'TransferFactory_Transfer' } },
                disclosedContracts,
              ]
            },
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.createTransfer',
      params: {
        sender: 'sender::party',
        recipient: 'receiver::party',
        amount: '7.5',
        instrumentId: 'Amulet',
        memo: 'lunch',
        expirationDate,
      },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, {
      commands: { ExerciseCommand: { choice: 'TransferFactory_Transfer' } },
      disclosedContracts,
    })
    assert.deepEqual(seen.params, {
      sender: 'sender::party',
      recipient: 'receiver::party',
      amount: '7.5',
      instrumentId: 'Amulet',
      registryUrl: new URL('http://localhost:2000/api/validator/v0/scan-proxy'),
      memo: 'lunch',
      expirationDate: new Date(expirationDate),
    })
  })

  it('looks up an Amulet transfer preapproval through the SDK Amulet namespace', async () => {
    // Scenario: Carpincho needs to know whether the selected party already
    // allows automatic Amulet receipts before rendering the enable/disable UI.
    const preapproval = {
      contract: {
        contract_id: 'preapproval-cid-1',
        template_id: 'Splice.AmuletRules:TransferPreapproval',
        payload: {
          expiresAt: '2026-06-11T12:00:00.000Z',
        },
      },
    }
    const seen: { receiver?: string } = {}
    const rpc = createRpc(withToken(), {
      now: () => new Date('2026-06-11T00:00:00.000Z'),
      sdkFactory: async () => ({
        amulet: {
          preapproval: {
            fetchQuick: async (receiver: string) => {
              seen.receiver = receiver
              return preapproval
            },
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'amulet.preapproval.status',
      params: { receiver: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, {
      contractId: 'preapproval-cid-1',
      templateId: 'Splice.AmuletRules:TransferPreapproval',
      expiresAt: '2026-06-11T12:00:00.000Z',
      active: true,
      expired: false,
    })
    assert.equal(seen.receiver, 'receiver::party')
  })

  it('returns inactive Amulet preapproval status without waiting when none exists', async () => {
    // Scenario: the Tokens tab polls this method every few seconds. Missing
    // preapproval must resolve immediately instead of using the SDK wait helper.
    const seen: { receiver?: string } = {}
    const rpc = createRpc(withToken(), {
      sdkFactory: async () => ({
        amulet: {
          preapproval: {
            fetchQuick: async (receiver: string) => {
              seen.receiver = receiver
              return null
            },
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'amulet.preapproval.status',
      params: { receiver: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, { active: false, expired: false })
    assert.equal(seen.receiver, 'receiver::party')
  })

  it('prepares an Amulet transfer preapproval proposal create command for the receiver party', async () => {
    // Scenario: the external receiver can only sign the proposal creation. The
    // validator provider accepts that proposal in a separate local-party submit.
    const rpc = createRpc(withToken(), {
      sdkFactory: async () => ({
        amulet: {
          preapproval: {
            ctx: {
              validatorParty: 'provider::party',
              amuletService: {
                scanProxyClient: {
                  getAmuletRules: async () => ({
                    template_id: '#splice-amulet:Splice.AmuletRules:AmuletRules',
                    contract_id: 'amulet-rules-cid',
                    created_event_blob: 'rules-blob',
                    payload: { dso: 'DSO::party' },
                  }),
                },
              },
            },
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'amulet.preapproval.create',
      params: { receiver: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, {
      commands: [
        {
          CreateCommand: {
            templateId:
              '#splice-wallet:Splice.Wallet.TransferPreapproval:TransferPreapprovalProposal',
            createArguments: {
              provider: 'provider::party',
              receiver: 'receiver::party',
              expectedDso: 'DSO::party',
            },
          },
        },
      ],
      disclosedContracts: [],
    })
  })

  it('prepares a fixed DevNet Amulet tap command for the receiver party', async () => {
    // Scenario: Carpincho needs a test-only faucet button that requests a fixed
    // 100 AMT for the selected external party while preserving local signing.
    const disclosedContracts = [{ contractId: 'tap-context-cid', createdEventBlob: 'blob' }]
    const seen: { receiver?: string; amount?: string } = {}
    const rpc = createRpc(withToken(), {
      sdkFactory: async () => ({
        amulet: {
          tap: async (receiver: string, amount: string) => {
            seen.receiver = receiver
            seen.amount = amount
            return [{ ExerciseCommand: { choice: 'AmuletRules_DevNet_Tap' } }, disclosedContracts]
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'amulet.tap',
      params: { receiver: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, {
      commands: { ExerciseCommand: { choice: 'AmuletRules_DevNet_Tap' } },
      disclosedContracts,
    })
    assert.equal(seen.receiver, 'receiver::party')
    assert.equal(seen.amount, '100')
  })

  it('accepts an Amulet transfer preapproval proposal as the validator provider', async () => {
    // Scenario: after Carpincho creates the receiver-signed proposal, the local
    // validator provider must accept it with a normal participant submit.
    const seen: { acs?: unknown; submit?: unknown; inputOwner?: string } = {}
    const rpc = createRpc(withToken(), {
      now: () => new Date('2026-06-10T00:00:00.000Z'),
      sdkFactory: async () => ({
        amulet: {
          preapproval: {
            ctx: {
              validatorParty: 'provider::party',
              commonCtx: { defaultSynchronizerId: 'sync-1' },
              amuletService: {
                scanProxyClient: {
                  getAmuletRules: async () => ({
                    template_id: '#splice-amulet:Splice.AmuletRules:AmuletRules',
                    contract_id: 'amulet-rules-cid',
                    created_event_blob: 'rules-blob',
                    payload: { dso: 'DSO::party' },
                  }),
                  getActiveOpenMiningRound: async () => ({
                    template_id: '#splice-amulet:Splice.Round:OpenMiningRound',
                    contract_id: 'open-round-cid',
                    created_event_blob: 'round-blob',
                  }),
                },
                tokenStandard: {
                  getInputHoldingsCids: async (owner: string) => {
                    seen.inputOwner = owner
                    return ['provider-holding-cid']
                  },
                },
              },
            },
          },
        },
        ledger: {
          acsReader: {
            readJsContracts: async (options: unknown) => {
              seen.acs = options
              return [
                {
                  contractId: 'proposal-cid',
                  templateId:
                    '#splice-wallet:Splice.Wallet.TransferPreapproval:TransferPreapprovalProposal',
                  createArgument: {
                    receiver: 'receiver::party',
                    provider: 'provider::party',
                    expectedDso: 'DSO::party',
                  },
                },
              ]
            },
          },
          internal: {
            submit: async (params: unknown) => {
              seen.submit = params
              return { updateId: 'accept-update-1', completionOffset: 42 }
            },
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'amulet.preapproval.acceptProposal',
      params: { receiver: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, { updateId: 'accept-update-1', completionOffset: 42 })
    assert.deepEqual(seen.acs, {
      parties: ['provider::party'],
      templateIds: ['#splice-wallet:Splice.Wallet.TransferPreapproval:TransferPreapprovalProposal'],
      filterByParty: true,
      continueUntilCompletion: false,
    })
    assert.deepEqual(seen.submit, {
      commands: [
        {
          ExerciseCommand: {
            templateId:
              '#splice-wallet:Splice.Wallet.TransferPreapproval:TransferPreapprovalProposal',
            contractId: 'proposal-cid',
            choice: 'TransferPreapprovalProposal_Accept',
            choiceArgument: {
              context: {
                context: {
                  openMiningRound: 'open-round-cid',
                  issuingMiningRounds: [],
                  validatorRights: [],
                  featuredAppRight: null,
                },
                amuletRules: 'amulet-rules-cid',
              },
              inputs: [{ tag: 'InputAmulet', value: 'provider-holding-cid' }],
              expiresAt: '2026-09-08T00:00:00.000Z',
            },
          },
        },
      ],
      disclosedContracts: [
        {
          templateId: '#splice-amulet:Splice.AmuletRules:AmuletRules',
          contractId: 'amulet-rules-cid',
          createdEventBlob: 'rules-blob',
          synchronizerId: 'sync-1',
        },
        {
          templateId: '#splice-amulet:Splice.Round:OpenMiningRound',
          contractId: 'open-round-cid',
          createdEventBlob: 'round-blob',
          synchronizerId: 'sync-1',
        },
      ],
      synchronizerId: 'sync-1',
      actAs: ['provider::party'],
    })
    assert.equal(seen.inputOwner, 'provider::party')
  })

  it('waits for an Amulet transfer preapproval proposal to become visible before accepting it', async () => {
    // Scenario: the receiver-signed proposal may not be visible in the provider ACS
    // immediately after interactive submission execute returns, so acceptance retries briefly.
    let readCount = 0
    const slept: number[] = []
    const rpc = createRpc(withToken(), {
      now: () => new Date('2026-06-10T00:00:00.000Z'),
      sleep: async (ms) => {
        slept.push(ms)
      },
      sdkFactory: async () => ({
        amulet: {
          preapproval: {
            ctx: {
              validatorParty: 'provider::party',
              commonCtx: { defaultSynchronizerId: 'sync-1' },
              amuletService: {
                scanProxyClient: {
                  getAmuletRules: async () => ({
                    template_id: '#splice-amulet:Splice.AmuletRules:AmuletRules',
                    contract_id: 'amulet-rules-cid',
                    created_event_blob: 'rules-blob',
                    payload: { dso: 'DSO::party' },
                  }),
                  getActiveOpenMiningRound: async () => ({
                    template_id: '#splice-amulet:Splice.Round:OpenMiningRound',
                    contract_id: 'open-round-cid',
                    created_event_blob: 'round-blob',
                  }),
                },
                tokenStandard: {
                  getInputHoldingsCids: async () => ['provider-holding-cid'],
                },
              },
            },
          },
        },
        ledger: {
          acsReader: {
            readJsContracts: async () => {
              readCount += 1
              if (readCount === 1) {
                return []
              }
              return [
                {
                  contractId: 'proposal-cid',
                  templateId:
                    '#splice-wallet:Splice.Wallet.TransferPreapproval:TransferPreapprovalProposal',
                  createArgument: {
                    receiver: 'receiver::party',
                    provider: 'provider::party',
                    expectedDso: 'DSO::party',
                  },
                },
              ]
            },
          },
          internal: {
            submit: async () => ({ updateId: 'accept-update-1' }),
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'amulet.preapproval.acceptProposal',
      params: { receiver: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, { updateId: 'accept-update-1' })
    assert.equal(readCount, 2)
    assert.deepEqual(slept, [1_000])
  })

  it('prepares an Amulet transfer preapproval cancel command for the receiver party', async () => {
    // Scenario: disabling auto-accept must prepare the SDK cancel command and
    // return any disclosed contracts required by interactive submission.
    const disclosedContracts = [{ contractId: 'preapproval-context-cid', createdEventBlob: 'blob' }]
    const seen: { parties?: unknown } = {}
    const rpc = createRpc(withToken(), {
      sdkFactory: async () => ({
        amulet: {
          preapproval: {
            fetchQuick: async () => ({ contract: { contract_id: 'preapproval-cid-1' } }),
            command: {
              cancel: async (args: unknown) => {
                seen.parties = (args as { parties?: unknown }).parties
                return [
                  { ExerciseCommand: { choice: 'TransferPreapproval_Cancel' } },
                  disclosedContracts,
                ]
              },
            },
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'amulet.preapproval.cancel',
      params: { receiver: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, {
      commands: [{ ExerciseCommand: { choice: 'TransferPreapproval_Cancel' } }],
      disclosedContracts,
    })
    assert.deepEqual(seen.parties, { receiver: 'receiver::party' })
  })

  it('returns no Amulet preapproval cancel command when the receiver is already disabled', async () => {
    // Scenario: Scan and the ledger can disagree briefly after cancel archives
    // a TransferPreapproval. A repeated disable must finish as an idempotent no-op.
    let cancelCalled = false
    const rpc = createRpc(withToken(), {
      sdkFactory: async () => ({
        amulet: {
          preapproval: {
            fetchQuick: async () => null,
            command: {
              cancel: async () => {
                cancelCalled = true
                throw new Error('cancel should not wait for a missing preapproval')
              },
            },
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'amulet.preapproval.cancel',
      params: { receiver: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, { commands: [], disclosedContracts: [] })
    assert.equal(cancelCalled, false)
  })

  it('lists token holding UTXOs through the SDK token namespace without reshaping contracts', async () => {
    // Scenario: Carpincho needs the active CIP-56 holdings for a party, but the
    // Node-only wallet SDK must stay behind wallet-service. The RPC returns the
    // SDK holding contracts unchanged so the browser boundary remains thin.
    const holdingContracts = [
      {
        contractId: 'holding-cid-1',
        interfaceViewValue: {
          owner: 'receiver::party',
          amount: '666.0000000000',
          instrumentId: { admin: 'admin::party', id: 'Amulet' },
        },
      },
    ]
    const seen: { params?: unknown; tokenConfig?: unknown } = {}
    const rpc = createRpc(withToken(), {
      sdkFactory: async (options) => {
        seen.tokenConfig = (options as { token?: unknown }).token
        return {
          token: {
            utxos: {
              list: async (params: unknown) => {
                seen.params = params
                return holdingContracts
              },
            },
          },
        }
      },
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.listHoldings',
      params: { partyId: 'receiver::party' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, holdingContracts)
    assert.deepEqual(seen.params, {
      partyId: 'receiver::party',
      includeLocked: true,
      limit: 100,
      continueUntilCompletion: true,
    })
    assert.deepEqual(seen.tokenConfig, {
      validatorUrl: 'http://localhost:2000/api/validator',
      auth: { method: 'static', token: 'backend.jwt' },
      registries: ['http://localhost:2000/api/validator/v0/scan-proxy'],
    })
  })

  it('lists Amulet holding summaries through Scan without listing UTXOs', async () => {
    // Scenario: CC/Amulet balances should use Scan's aggregate endpoint so the
    // wallet can show a balance without walking every Holding UTXO.
    const calls: { url: string; body?: unknown }[] = []
    const rpc = createRpc(withToken(), {
      now: () => new Date('2026-06-10T12:00:00.000Z'),
      sdkFactory: async () => {
        throw new Error('SDK should not list UTXOs for Amulet summary')
      },
      fetch: async (url, init) => {
        calls.push({
          url: String(url),
          body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
        })
        return new Response(
          JSON.stringify({
            summaries: [
              {
                party_id: 'receiver::party',
                total_unlocked_coin: '7.0000000000',
                total_locked_coin: '2.0000000000',
                total_coin_holdings: '9.0000000000',
                accumulated_holding_fees_unlocked: '0.1000000000',
                accumulated_holding_fees_locked: '0.2000000000',
                accumulated_holding_fees_total: '0.3000000000',
                total_available_coin: '8.7000000000',
              },
            ],
            record_time: '2026-06-10T12:00:00.000Z',
            migration_id: 0,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      },
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.listHoldingSummary',
      params: { partyId: 'receiver::party', instrumentId: { id: 'Amulet' } },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, [
      {
        key: 'unknown-admin:Amulet',
        tokenLabel: 'Amulet',
        instrumentId: { id: 'Amulet' },
        totalAmount: '8.7000000000',
        source: 'scan',
        scan: {
          totalUnlockedCoin: '7.0000000000',
          totalLockedCoin: '2.0000000000',
          totalCoinHoldings: '9.0000000000',
          accumulatedHoldingFeesUnlocked: '0.1000000000',
          accumulatedHoldingFeesLocked: '0.2000000000',
          accumulatedHoldingFeesTotal: '0.3000000000',
          totalAvailableCoin: '8.7000000000',
        },
      },
    ])
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.url, 'http://scan.localhost:4000/api/scan/v0/holdings/summary')
    assert.deepEqual(calls[0]?.body, {
      migration_id: 0,
      record_time: '2026-06-10T12:00:00.000Z',
      record_time_match: 'at_or_before',
      owner_party_ids: ['receiver::party'],
    })
  })

  it('falls back to UTXO summaries when Scan cannot summarize Amulet', async () => {
    // Scenario: local Scan may be unavailable or lagging. The summary RPC must still
    // return a correct balance by falling back to the existing SDK UTXO path.
    const holdingContracts = [
      {
        contractId: 'holding-cid-1',
        interfaceViewValue: {
          owner: 'receiver::party',
          amount: '4.0000000000',
          instrumentId: { admin: 'admin::party', id: 'Amulet' },
          lock: null,
        },
      },
      {
        contractId: 'holding-cid-2',
        interfaceViewValue: {
          owner: 'receiver::party',
          amount: '3.0000000000',
          instrumentId: { admin: 'admin::party', id: 'Amulet' },
          lock: { holders: ['validator::party'] },
        },
      },
    ]
    const seen: { params?: unknown } = {}
    const rpc = createRpc(withToken(), {
      fetch: async () => new Response('scan unavailable', { status: 503 }),
      sdkFactory: async () => ({
        token: {
          utxos: {
            list: async (params: unknown) => {
              seen.params = params
              return holdingContracts
            },
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.listHoldingSummary',
      params: { partyId: 'receiver::party', instrumentId: { id: 'Amulet' } },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, [
      {
        key: 'admin::party:Amulet',
        tokenLabel: 'Amulet',
        instrumentId: { admin: 'admin::party', id: 'Amulet' },
        totalAmount: '7',
        utxoCount: 2,
        lockedCount: 1,
        unlockedCount: 1,
        holdings: holdingContracts,
        source: 'utxos',
      },
    ])
    assert.deepEqual(seen.params, {
      partyId: 'receiver::party',
      includeLocked: true,
      limit: 100,
      continueUntilCompletion: true,
    })
  })

  it('summarizes non-Amulet tokens from UTXOs without calling Scan', async () => {
    // Scenario: Scan aggregates only CC/Amulet. Other CIP-56 tokens must use the
    // generic UTXO list and filter by the requested instrument.
    let scanCalled = false
    const rpc = createRpc(withToken(), {
      fetch: async () => {
        scanCalled = true
        return new Response('{}')
      },
      sdkFactory: async () => ({
        token: {
          utxos: {
            list: async () => [
              {
                contractId: 'holding-cid-1',
                interfaceViewValue: {
                  amount: '5',
                  instrumentId: { admin: 'issuer::party', id: 'MockToken' },
                },
              },
              {
                contractId: 'holding-cid-2',
                interfaceViewValue: {
                  amount: '99',
                  instrumentId: { admin: 'admin::party', id: 'Amulet' },
                },
              },
            ],
          },
        },
      }),
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.listHoldingSummary',
      params: {
        partyId: 'receiver::party',
        instrumentId: { admin: 'issuer::party', id: 'MockToken' },
      },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.equal(scanCalled, false)
    const expectedHolding = {
      contractId: 'holding-cid-1',
      interfaceViewValue: {
        amount: '5',
        instrumentId: { admin: 'issuer::party', id: 'MockToken' },
      },
    }
    assert.deepEqual(res.result, [
      {
        key: 'issuer::party:MockToken',
        tokenLabel: 'MockToken',
        instrumentId: { admin: 'issuer::party', id: 'MockToken' },
        totalAmount: '5',
        utxoCount: 1,
        lockedCount: 0,
        unlockedCount: 1,
        holdings: [expectedHolding],
        source: 'utxos',
      },
    ])
  })

  it('rejects CIP-56 helper calls without required params', async () => {
    // Scenario: malformed Carpincho calls should fail as JSON-RPC invalid
    // params before the SDK is initialized or any Splice service is contacted.
    const rpc = createRpc(withToken(), {
      sdkFactory: async () => {
        throw new Error('SDK should not be initialized')
      },
    })

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.listPendingTransfers',
      params: {},
    })) as JsonRpcResponse

    assert.ok('error' in res)
    assert.equal(res.error.code, -32602)
  })
})

describe('error serialization', () => {
  // SDK rejections are plain JsCantonError objects, not Error instances.
  const cantonError = {
    code: 'LEDGER_API_INTERNAL_ERROR',
    cause: 'Expected ujson.Arr (data: {"map":[]})',
    errorCategory: 4,
    correlationId: 'abc123',
  }

  it('errorMessage surfaces code and cause from a JsCantonError-shaped object', () => {
    assert.equal(
      errorMessage(cantonError),
      'LEDGER_API_INTERNAL_ERROR: Expected ujson.Arr (data: {"map":[]})',
    )
  })

  it('errorMessage keeps Error messages as-is', () => {
    assert.equal(errorMessage(new Error('boom')), 'boom')
  })

  it('errorMessage passes strings through', () => {
    assert.equal(errorMessage('plain failure'), 'plain failure')
  })

  it('errorMessage serializes other objects as JSON instead of "[object Object]"', () => {
    assert.equal(errorMessage({ reason: 'no' }), '{"reason":"no"}')
  })

  it('errorMessage falls back to String() for unserializable objects', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    assert.equal(errorMessage(circular), '[object Object]')
  })

  it('errorData passes a plain-object rejection through as data', () => {
    assert.deepEqual(errorData(cantonError), cantonError)
  })

  it('errorData wraps primitives in { raw }', () => {
    assert.deepEqual(errorData('boom'), { raw: 'boom' })
  })

  it('errorData keeps name and message for Error instances', () => {
    const data = errorData(new Error('boom'))
    assert.equal(data.name, 'Error')
    assert.equal(data.message, 'boom')
  })
})
