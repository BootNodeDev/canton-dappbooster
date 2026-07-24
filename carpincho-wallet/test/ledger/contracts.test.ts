import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import {
  type ActiveContract,
  contractMatchesQuery,
  createContract,
  exerciseContract,
  listActiveContracts,
  matchesTemplate,
} from '@/ledger/contracts'
import type { AccountPublic } from '@/vault/types'

const originalFetch = globalThis.fetch

const ACCOUNT: AccountPublic = {
  // Contract utility actions are signed by the active vault account's Canton party.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

describe('ledger contract helpers', () => {
  afterEach(() => {
    // Each scenario owns the JSON-RPC fake so call ordering stays explicit.
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  it('creates a contract by preparing a CreateCommand and signing with the active account', async () => {
    // Scenario: a developer pastes a template id and JSON payload into Carpincho.
    // The helper must build the ledger CreateCommand, ask wallet-service to prepare it,
    // sign only the prepared hash locally, submit the signature, and record the raw command.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'prepareTransaction') {
        return new Response(
          JSON.stringify({
            result: {
              preparedTransaction: 'prepared-create',
              preparedTransactionHash: 'prepared-create-hash',
              hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'executePrepared') {
        return new Response(
          JSON.stringify({ result: { updateId: 'update-1', completionOffset: 42 } }),
          { status: 200 },
        )
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch
    const recorded: unknown[] = []

    const result = await createContract({
      account: ACCOUNT,
      templateId: 'pkg:Module:Template',
      createArguments: { admin: 'alice::party' },
      signMessage: async (accountId, messageBase64) => {
        assert.equal(accountId, 'account-1')
        assert.equal(messageBase64, 'prepared-create-hash')
        return 'signature-base64'
      },
      recordTransaction: async (tx) => {
        recorded.push(tx)
        return { ...tx, id: 'tx-1', createdAt: 2 }
      },
    })

    assert.deepEqual(result, { updateId: 'update-1', completionOffset: 42 })
    assert.deepEqual(
      calls.map((call) => call.method),
      ['prepareTransaction', 'executePrepared'],
    )
    assert.deepEqual(calls[0]?.params, {
      partyId: 'alice::party',
      actAs: ['alice::party'],
      commands: [
        {
          CreateCommand: {
            templateId: 'pkg:Module:Template',
            createArguments: { admin: 'alice::party' },
          },
        },
      ],
    })
    assert.equal((recorded[0] as { method?: string } | undefined)?.method, 'ledger.contract.create')
  })

  it('exercises a choice by preparing an ExerciseCommand and signing with the active account', async () => {
    // Scenario: a developer has a contract id and a raw DAML choice argument.
    // The helper should build exactly one ExerciseCommand, keep signing local, submit it,
    // and preserve the original command in activity history for audit.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'prepareTransaction') {
        return new Response(
          JSON.stringify({
            result: {
              preparedTransaction: 'prepared-exercise',
              preparedTransactionHash: 'prepared-exercise-hash',
              hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'executePrepared') {
        return new Response(
          JSON.stringify({ result: { updateId: 'exercise-update-1', completionOffset: 43 } }),
          { status: 200 },
        )
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch
    const recorded: unknown[] = []

    const result = await exerciseContract({
      account: ACCOUNT,
      templateId: 'pkg:Module:Template',
      contractId: 'cid-1',
      choice: 'Template_DoThing',
      choiceArgument: { receiver: 'bob::party', amount: '5.0' },
      signMessage: async (accountId, messageBase64) => {
        assert.equal(accountId, 'account-1')
        assert.equal(messageBase64, 'prepared-exercise-hash')
        return 'signature-base64'
      },
      recordTransaction: async (tx) => {
        recorded.push(tx)
        return { ...tx, id: 'tx-2', createdAt: 3 }
      },
    })

    assert.deepEqual(result, { updateId: 'exercise-update-1', completionOffset: 43 })
    assert.deepEqual(
      calls.map((call) => call.method),
      ['prepareTransaction', 'executePrepared'],
    )
    assert.deepEqual(calls[0]?.params, {
      partyId: 'alice::party',
      actAs: ['alice::party'],
      commands: [
        {
          ExerciseCommand: {
            templateId: 'pkg:Module:Template',
            contractId: 'cid-1',
            choice: 'Template_DoThing',
            choiceArgument: { receiver: 'bob::party', amount: '5.0' },
          },
        },
      ],
    })
    assert.equal(
      (recorded[0] as { method?: string } | undefined)?.method,
      'ledger.contract.exercise',
    )
  })

  it('lists active contracts for a party through the wallet-service ledgerApi proxy', async () => {
    // Scenario: the Contracts tab shows the active ledger state for the selected party.
    // The helper should request ACS from JSON API v2 and preserve contract ids, template ids,
    // create arguments, and offsets so the UI can inspect the exact ledger payload.
    const contracts: ActiveContract[] = [
      {
        contractId: 'cid-1',
        templateId: 'pkg:Module:Template',
        createArgument: { admin: 'alice::party' },
        createdOffset: 41,
      },
      {
        contractId: 'cid-other',
        templateId: 'pkg:Module:Other',
        createArgument: { admin: 'alice::party' },
        createdOffset: 42,
      },
    ]
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (calls.length === 1) {
        return new Response(JSON.stringify({ result: { offset: 99 } }), { status: 200 })
      }
      return new Response(
        JSON.stringify({
          result: contracts.map((contract) => ({
            contractEntry: {
              JsActiveContract: {
                createdEvent: {
                  contractId: contract.contractId,
                  templateId: contract.templateId,
                  createArgument: contract.createArgument,
                  offset: contract.createdOffset,
                },
              },
            },
          })),
        }),
        { status: 200 },
      )
    }) as typeof globalThis.fetch

    const result = await listActiveContracts({
      partyId: 'alice::party',
    })

    assert.deepEqual(result, contracts)
    assert.deepEqual(calls, [
      {
        method: 'ledgerApi',
        params: {
          requestMethod: 'get',
          resource: '/v2/state/ledger-end',
        },
      },
      {
        method: 'ledgerApi',
        params: {
          requestMethod: 'post',
          resource: '/v2/state/active-contracts',
          body: {
            filter: {
              filtersByParty: {
                'alice::party': {
                  cumulative: [
                    {
                      identifierFilter: {
                        WildcardFilter: {
                          value: {
                            includeCreatedEventBlob: false,
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
            activeAtOffset: 99,
            verbose: true,
          },
        },
      },
    ])
  })
})

describe('matchesTemplate', () => {
  const contract: ActiveContract = {
    contractId: 'cid',
    templateId: 'pkg:Module:Template',
    createArgument: {},
  }

  it('keeps every contract when the filter is empty or whitespace', () => {
    assert.equal(matchesTemplate(contract, undefined), true)
    assert.equal(matchesTemplate(contract, ''), true)
    assert.equal(matchesTemplate(contract, '   '), true)
  })

  it('matches the exact template id', () => {
    assert.equal(matchesTemplate(contract, 'pkg:Module:Template'), true)
  })

  it('matches a package-agnostic module:template suffix', () => {
    assert.equal(matchesTemplate(contract, 'Module:Template'), true)
  })

  it('matches a bare template-name suffix', () => {
    assert.equal(matchesTemplate(contract, 'Template'), true)
    assert.equal(matchesTemplate(contract, 'Other'), false)
  })
})

describe('contractMatchesQuery', () => {
  const contract: ActiveContract = {
    contractId: '0041299d46bcfba01e',
    templateId: 'pkg:Module:Template',
    createArgument: {},
  }

  it('keeps every contract when the query is empty or whitespace', () => {
    assert.equal(contractMatchesQuery(contract, ''), true)
    assert.equal(contractMatchesQuery(contract, '   '), true)
  })

  it('matches on the template id like matchesTemplate', () => {
    assert.equal(contractMatchesQuery(contract, 'Module:Template'), true)
    assert.equal(contractMatchesQuery(contract, 'Other'), false)
  })

  it('matches a case-insensitive substring of the contract id', () => {
    assert.equal(contractMatchesQuery(contract, '1299d46'), true)
    assert.equal(contractMatchesQuery(contract, 'BCFBA01E'), true)
    assert.equal(contractMatchesQuery(contract, 'deadbeef'), false)
  })
})
