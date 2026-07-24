import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import {
  cancelAmuletPreapproval,
  createAmuletPreapproval,
  getAmuletPreapprovalStatus,
  tapAmulet,
} from '@/cip56/amuletPreapproval'
import type { AccountPublic } from '@/vault/types'

const originalFetch = globalThis.fetch

const ACCOUNT: AccountPublic = {
  // Account fixture represents the self-custodial party enabling automatic Amulet receipts.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

describe('Amulet preapproval helpers', () => {
  afterEach(() => {
    // Tests replace the JSON-RPC transport globally, so restore it after each scenario.
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  it('reads Amulet preapproval status through wallet-service', async () => {
    // Scenario: Carpincho should display whether the selected receiver party
    // already has an active TransferPreapproval contract.
    const methods: string[] = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown }
      methods.push(body.method)
      assert.deepEqual(body.params, { receiver: 'alice::party' })
      return new Response(
        JSON.stringify({
          result: {
            active: true,
            expired: false,
            contractId: 'preapproval-cid-1',
            expiresAt: '2026-06-11T12:00:00.000Z',
          },
        }),
        { status: 200 },
      )
    }) as typeof globalThis.fetch

    const result = await getAmuletPreapprovalStatus('alice::party')

    assert.deepEqual(methods, ['amulet.preapproval.status'])
    assert.deepEqual(result, {
      active: true,
      expired: false,
      contractId: 'preapproval-cid-1',
      expiresAt: '2026-06-11T12:00:00.000Z',
    })
  })

  it('creates an Amulet preapproval using Carpincho local signing', async () => {
    // Scenario: enabling auto-accept prepares the SDK command in wallet-service,
    // then Carpincho signs the proposal while Splice accepts it asynchronously.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'amulet.preapproval.create') {
        return new Response(
          JSON.stringify({
            result: {
              commands: { CreateCommand: { templateId: 'TransferPreapprovalProposal' } },
              disclosedContracts: [],
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'prepareTransaction') {
        return new Response(
          JSON.stringify({
            result: {
              preparedTransaction: 'prepared-create-tx',
              preparedTransactionHash: 'prepared-create-hash',
              hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'executePrepared') {
        return new Response(JSON.stringify({ result: { updateId: 'update-create-1' } }), {
          status: 200,
        })
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch
    const recorded: unknown[] = []

    const result = await createAmuletPreapproval({
      account: ACCOUNT,
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

    assert.deepEqual(result, { updateId: 'update-create-1' })
    assert.deepEqual(
      calls.map((call) => call.method),
      ['amulet.preapproval.create', 'prepareTransaction', 'executePrepared'],
    )
    assert.deepEqual(calls[0]?.params, { receiver: 'alice::party' })
    assert.deepEqual(calls[1]?.params.actAs, ['alice::party'])
    assert.equal(
      (recorded[0] as { method?: string } | undefined)?.method,
      'amulet.preapproval.create',
    )
  })

  it('taps a fixed 100 AMT amount using Carpincho local signing', async () => {
    // Scenario: the Assets tab faucet button should request one fixed 100 AMT
    // tap for the selected party, then sign and execute the prepared command.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'amulet.tap') {
        return new Response(
          JSON.stringify({
            result: {
              commands: { ExerciseCommand: { choice: 'AmuletRules_DevNet_Tap' } },
              disclosedContracts: [{ contractId: 'tap-context-cid' }],
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'prepareTransaction') {
        return new Response(
          JSON.stringify({
            result: {
              preparedTransaction: 'prepared-tap-tx',
              preparedTransactionHash: 'prepared-tap-hash',
              hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'executePrepared') {
        return new Response(JSON.stringify({ result: { updateId: 'update-tap-1' } }), {
          status: 200,
        })
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch

    const result = await tapAmulet({
      account: ACCOUNT,
      signMessage: async (accountId, messageBase64) => {
        assert.equal(accountId, 'account-1')
        assert.equal(messageBase64, 'prepared-tap-hash')
        return 'signature-base64'
      },
    })

    assert.deepEqual(result, { updateId: 'update-tap-1' })
    assert.deepEqual(
      calls.map((call) => call.method),
      ['amulet.tap', 'prepareTransaction', 'executePrepared'],
    )
    assert.deepEqual(calls[0]?.params, { receiver: 'alice::party' })
    assert.deepEqual(calls[1]?.params.disclosedContracts, [{ contractId: 'tap-context-cid' }])
  })

  it('cancels an Amulet preapproval using Carpincho local signing', async () => {
    // Scenario: disabling auto-accept follows the same self-custodial signing
    // flow as create, but requests the SDK cancel command.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'amulet.preapproval.cancel') {
        return new Response(
          JSON.stringify({
            result: {
              commands: { ExerciseCommand: { choice: 'TransferPreapproval_Cancel' } },
              disclosedContracts: [{ contractId: 'preapproval-context-cid' }],
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'prepareTransaction') {
        return new Response(
          JSON.stringify({
            result: {
              preparedTransaction: 'prepared-cancel-tx',
              preparedTransactionHash: 'prepared-cancel-hash',
              hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'executePrepared') {
        return new Response(JSON.stringify({ result: { updateId: 'update-cancel-1' } }), {
          status: 200,
        })
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch

    const result = await cancelAmuletPreapproval({
      account: ACCOUNT,
      signMessage: async () => 'signature-base64',
    })

    assert.deepEqual(result, { updateId: 'update-cancel-1' })
    assert.deepEqual(
      calls.map((call) => call.method),
      ['amulet.preapproval.cancel', 'prepareTransaction', 'executePrepared'],
    )
    assert.deepEqual(calls[0]?.params, { receiver: 'alice::party' })
    assert.deepEqual(calls[1]?.params.disclosedContracts, [
      { contractId: 'preapproval-context-cid' },
    ])
  })

  it('finishes cancel when the preapproval was already archived before prepare', async () => {
    // Scenario: Scan can expose a TransferPreapproval contract that is archived
    // before interactive submission prepares the cancel command. Once status is
    // inactive, Carpincho should treat the disable action as complete.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'amulet.preapproval.cancel') {
        return new Response(
          JSON.stringify({
            result: {
              commands: { ExerciseCommand: { choice: 'TransferPreapproval_Cancel' } },
              disclosedContracts: [],
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'prepareTransaction') {
        return new Response(
          JSON.stringify({
            error: {
              code: -32000,
              message: 'CONTRACT_NOT_FOUND: Contract could not be found',
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'amulet.preapproval.status') {
        return new Response(
          JSON.stringify({
            result: { active: false, expired: false },
          }),
          { status: 200 },
        )
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch

    const result = await cancelAmuletPreapproval({
      account: ACCOUNT,
      signMessage: async () => {
        throw new Error('cancel no-op should not request a signature')
      },
    })

    assert.deepEqual(result, {})
    assert.deepEqual(
      calls.map((call) => call.method),
      ['amulet.preapproval.cancel', 'prepareTransaction', 'amulet.preapproval.status'],
    )
  })

  it('finishes cancel when wallet-service returns no cancel command', async () => {
    // Scenario: wallet-service can discover that the receiver is already
    // disabled before command creation. Carpincho should not prepare or sign.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'amulet.preapproval.cancel') {
        return new Response(
          JSON.stringify({
            result: {
              commands: [],
              disclosedContracts: [],
            },
          }),
          { status: 200 },
        )
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch

    const result = await cancelAmuletPreapproval({
      account: ACCOUNT,
      signMessage: async () => {
        throw new Error('empty cancel should not request a signature')
      },
    })

    assert.deepEqual(result, {})
    assert.deepEqual(
      calls.map((call) => call.method),
      ['amulet.preapproval.cancel'],
    )
  })
})
