import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { createMockPartyApi, createMockRpc, createMockState, isMockEnabled } from '../src/mock.ts'
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

describe('isMockEnabled', () => {
  it('returns false when WALLET_SERVICE_MOCK is unset', () => {
    delete process.env.WALLET_SERVICE_MOCK
    assert.equal(isMockEnabled(), false)
  })

  for (const truthy of ['1', 'true', 'yes', 'on', 'TRUE', 'On']) {
    it(`returns true for WALLET_SERVICE_MOCK=${truthy}`, () => {
      process.env.WALLET_SERVICE_MOCK = truthy
      assert.equal(isMockEnabled(), true)
      delete process.env.WALLET_SERVICE_MOCK
    })
  }
})

describe('createMockRpc', () => {
  it('serviceInfo reports mock: true and the -mock network suffix', () => {
    const rpc = createMockRpc(baseConfig())
    const info = rpc.serviceInfo() as Record<string, unknown>
    assert.equal(info.mock, true)
    assert.equal(info.network, 'canton:local-mock')
  })

  it('status returns the mocked provider, connection, and network shape', async () => {
    const rpc = createMockRpc(baseConfig())
    const res = (await rpc.handle({ jsonrpc: '2.0', id: 1, method: 'status' })) as JsonRpcResponse
    assert.ok('result' in res)
    const status = res.result as {
      provider: { id: string }
      connection: { isNetworkConnected: boolean }
      network: { networkId: string }
    }
    assert.equal(status.provider.id, 'wallet-service')
    assert.equal(status.connection.isNetworkConnected, true)
    assert.equal(status.network.networkId, 'canton:local-mock')
  })

  it('prepareTransaction returns canned prepared response without an SDK', async () => {
    const rpc = createMockRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'prepareTransaction',
      params: { partyId: 'alice::mock-abc', commands: [] },
    })) as JsonRpcResponse
    assert.ok('result' in res)
    const result = res.result as { preparedTransactionHash: string; hashingSchemeVersion: string }
    assert.ok(typeof result.preparedTransactionHash === 'string')
    assert.equal(result.hashingSchemeVersion, 'HASHING_SCHEME_VERSION_V2')
  })

  it('executePrepared advances the offset monotonically', async () => {
    const state = createMockState()
    const rpc = createMockRpc(baseConfig(), state)
    const params = {
      partyId: 'alice::mock',
      preparedTransaction: 'tx',
      preparedTransactionHash: 'hash',
      signatureBase64: 'sig',
    }
    const first = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'executePrepared',
      params,
    })) as JsonRpcResponse
    const second = (await rpc.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'executePrepared',
      params,
    })) as JsonRpcResponse
    assert.ok('result' in first)
    assert.ok('result' in second)
    const a = (first.result as { completionOffset: number }).completionOffset
    const b = (second.result as { completionOffset: number }).completionOffset
    assert.ok(b > a)
  })

  it('getSdk throws — mock mode has no SDK', async () => {
    const rpc = createMockRpc(baseConfig())
    await assert.rejects(() => rpc.getSdk(), /SDK is not available/)
  })

  it('reserved methods still return -32004', async () => {
    const rpc = createMockRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'signMessage',
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32004)
  })

  it('cip56.listPendingTransfers returns no mock transfers', async () => {
    // Scenario: Carpincho polls pending token transfers in the Assets tab.
    // Mock mode should keep that UI quiet instead of surfacing a method-not-found
    // error when no Canton or Splice services are running.
    const rpc = createMockRpc(baseConfig())

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.listPendingTransfers',
      params: { partyId: 'alice::mock' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, [])
  })

  it('cip56.listHoldings returns no mock holdings', async () => {
    // Scenario: the Tokens tab polls holdings through wallet-service. Mock mode
    // has no ledger state, so it should render an empty token list without
    // raising a method-not-found error.
    const rpc = createMockRpc(baseConfig())

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'cip56.listHoldings',
      params: { partyId: 'alice::mock' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, [])
  })

  it('amulet.preapproval.status returns an empty mock status', async () => {
    // Scenario: mock mode has no Scan or ledger contracts, but Carpincho should
    // still render the preapproval controls without a method-not-found error.
    const rpc = createMockRpc(baseConfig())

    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'amulet.preapproval.status',
      params: { receiver: 'alice::mock' },
    })) as JsonRpcResponse

    assert.ok('result' in res)
    assert.deepEqual(res.result, { active: false, expired: false })
  })
})

describe('createMockPartyApi', () => {
  it('prepare returns { onboardingId, partyId, multiHash } without an SDK', async () => {
    const api = createMockPartyApi(baseConfig())
    const result = (await api.prepare({ publicKeyBase64: 'pk', partyHint: 'alice' })) as Record<
      string,
      unknown
    >
    assert.ok(typeof result.onboardingId === 'string')
    assert.ok(
      typeof result.partyId === 'string' && (result.partyId as string).startsWith('alice::mock-'),
    )
    assert.ok(typeof result.multiHash === 'string')
  })

  it('complete consumes the prepared entry and returns the synthesized partyId', async () => {
    const state = createMockState()
    const api = createMockPartyApi(baseConfig(), state)
    const prep = (await api.prepare({ publicKeyBase64: 'pk', partyHint: 'bob' })) as {
      onboardingId: string
      partyId: string
    }
    const completed = (await api.complete({
      onboardingId: prep.onboardingId,
      signatureBase64: 'sig',
    })) as { partyId: string }
    assert.equal(completed.partyId, prep.partyId)
    assert.equal(api.pendingSize(), 0)
  })

  it('complete rejects unknown onboardingId with InvalidParams', async () => {
    const api = createMockPartyApi(baseConfig())
    await assert.rejects(
      () => api.complete({ onboardingId: 'unknown', signatureBase64: 'sig' }),
      /not found or expired/,
    )
  })
})
