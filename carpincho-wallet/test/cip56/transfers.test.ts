import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import {
  acceptPendingTransfer,
  createTokenTransfer,
  listPendingIncomingTransfers,
  type PendingTokenTransfer,
  transferDirection,
} from '@/cip56/transfers'
import type { AccountPublic } from '@/vault/types'

const originalFetch = globalThis.fetch

const ACCOUNT: AccountPublic = {
  // Account fixture represents the self-custodial party that receives an incoming CIP-56 transfer.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

describe('CIP-56 wallet-service transfer helpers', () => {
  afterEach(() => {
    // Each test replaces fetch with a purpose-built JSON-RPC fake, so restore the global afterward.
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  it('lists pending incoming transfers through wallet-service without reshaping SDK contracts', async () => {
    // Scenario: wallet-service returns the raw-ish SDK pending transfer contracts.
    // Carpincho should pass that shape through so a future browser SDK can replace this adapter directly.
    const pendingContracts = [
      {
        contractId: 'transfer-cid-1',
        interfaceViewValue: {
          transfer: {
            sender: 'sender::party',
            receiver: 'alice::party',
            amount: '12.5',
            instrumentId: { admin: 'admin::party', id: 'Amulet' },
          },
        },
      },
    ]
    const methods: string[] = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown }
      methods.push(body.method)
      assert.deepEqual(body.params, { partyId: 'alice::party' })
      return new Response(JSON.stringify({ result: pendingContracts }), { status: 200 })
    }) as typeof globalThis.fetch

    const result = await listPendingIncomingTransfers('alice::party')

    assert.deepEqual(result, pendingContracts)
    assert.deepEqual(methods, ['cip56.listPendingTransfers'])
  })

  it('accepts a pending transfer by asking wallet-service for commands and keeping signing in Carpincho', async () => {
    // Scenario: wallet-service uses Node-only SDK helpers to prepare the CIP-56 accept command.
    // Carpincho then prepares, signs, executes, and records the transaction with its local vault key.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'cip56.acceptTransfer') {
        return new Response(
          JSON.stringify({
            result: {
              commands: { ExerciseCommand: { choice: 'AcceptTransferInstruction' } },
              disclosedContracts: [
                { contractId: 'registry-context-cid', createdEventBlob: 'blob' },
              ],
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'prepareTransaction') {
        return new Response(
          JSON.stringify({
            result: {
              preparedTransaction: 'prepared-tx',
              preparedTransactionHash: 'prepared-hash',
              hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'executePrepared') {
        return new Response(JSON.stringify({ result: { updateId: 'update-1' } }), { status: 200 })
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch
    const recorded: unknown[] = []

    const result = await acceptPendingTransfer({
      account: ACCOUNT,
      transferInstructionCid: 'transfer-cid-1',
      signMessage: async (accountId, messageBase64) => {
        assert.equal(accountId, 'account-1')
        assert.equal(messageBase64, 'prepared-hash')
        return 'signature-base64'
      },
      recordTransaction: async (tx) => {
        recorded.push(tx)
        return { ...tx, id: 'tx-1', createdAt: 2 }
      },
    })

    assert.deepEqual(result, { updateId: 'update-1' })
    assert.deepEqual(
      calls.map((call) => call.method),
      ['cip56.acceptTransfer', 'prepareTransaction', 'executePrepared'],
    )
    assert.deepEqual(calls[0]?.params, { transferInstructionCid: 'transfer-cid-1' })
    assert.deepEqual(calls[1]?.params, {
      partyId: 'alice::party',
      actAs: ['alice::party'],
      commands: { ExerciseCommand: { choice: 'AcceptTransferInstruction' } },
      disclosedContracts: [{ contractId: 'registry-context-cid', createdEventBlob: 'blob' }],
    })
    assert.deepEqual(calls[2]?.params, {
      preparedTransaction: 'prepared-tx',
      preparedTransactionHash: 'prepared-hash',
      hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
      partyId: 'alice::party',
      signatureBase64: 'signature-base64',
    })
    assert.equal((recorded[0] as { method?: string } | undefined)?.method, 'cip56.transfer.accept')
  })

  it('creates a token transfer by preparing SDK commands and signing only the prepared hash', async () => {
    // Scenario: sending a CIP-56 token should keep the wallet-service SDK boundary
    // thin. Carpincho sends transfer intent data, receives commands, signs the
    // prepared transaction hash locally, and submits that signature.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'cip56.createTransfer') {
        return new Response(
          JSON.stringify({
            result: {
              commands: { ExerciseCommand: { choice: 'TransferFactory_Transfer' } },
              disclosedContracts: [
                { contractId: 'transfer-context-cid', createdEventBlob: 'blob' },
              ],
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'prepareTransaction') {
        return new Response(
          JSON.stringify({
            result: {
              preparedTransaction: 'prepared-transfer-tx',
              preparedTransactionHash: 'prepared-transfer-hash',
              hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'executePrepared') {
        return new Response(JSON.stringify({ result: { updateId: 'update-transfer-1' } }), {
          status: 200,
        })
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch
    const expirationDate = '2026-06-10T15:00:00.000Z'
    const recorded: unknown[] = []

    const result = await createTokenTransfer({
      account: ACCOUNT,
      recipient: 'receiver::party',
      amount: '7.5',
      instrumentId: { admin: 'admin::party', id: 'Amulet' },
      memo: 'lunch',
      expirationDate,
      signMessage: async (accountId, messageBase64) => {
        assert.equal(accountId, 'account-1')
        assert.equal(messageBase64, 'prepared-transfer-hash')
        return 'signature-base64'
      },
      recordTransaction: async (tx) => {
        recorded.push(tx)
        return { ...tx, id: 'tx-transfer-1', createdAt: 3 }
      },
    })

    assert.deepEqual(result, { updateId: 'update-transfer-1' })
    assert.deepEqual(
      calls.map((call) => call.method),
      ['cip56.createTransfer', 'prepareTransaction', 'executePrepared'],
    )
    assert.deepEqual(calls[0]?.params, {
      sender: 'alice::party',
      recipient: 'receiver::party',
      amount: '7.5',
      instrumentId: 'Amulet',
      memo: 'lunch',
      expirationDate,
    })
    assert.deepEqual(calls[1]?.params, {
      partyId: 'alice::party',
      actAs: ['alice::party'],
      commands: { ExerciseCommand: { choice: 'TransferFactory_Transfer' } },
      disclosedContracts: [{ contractId: 'transfer-context-cid', createdEventBlob: 'blob' }],
    })
    assert.equal((recorded[0] as { method?: string } | undefined)?.method, 'cip56.transfer.create')
  })
})

describe('transferDirection', () => {
  const transferWith = (sender?: string, receiver?: string): PendingTokenTransfer => ({
    contractId: 'cid',
    interfaceViewValue: { transfer: { sender, receiver } },
  })

  it('is outgoing only when the party sent it to someone else', () => {
    assert.equal(
      transferDirection(transferWith('alice::party', 'bob::party'), 'alice::party'),
      'outgoing',
    )
  })

  it('is incoming when the party is the receiver', () => {
    assert.equal(
      transferDirection(transferWith('bob::party', 'alice::party'), 'alice::party'),
      'incoming',
    )
  })

  it('is incoming for a transfer the party sent to itself', () => {
    assert.equal(
      transferDirection(transferWith('alice::party', 'alice::party'), 'alice::party'),
      'incoming',
    )
  })

  it('defaults to incoming when the party id is unknown', () => {
    assert.equal(
      transferDirection(transferWith('alice::party', 'bob::party'), undefined),
      'incoming',
    )
  })
})
