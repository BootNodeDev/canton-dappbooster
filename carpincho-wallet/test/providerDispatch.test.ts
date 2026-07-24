import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  CANTON_METHOD_GET_ACTIVE_NETWORK,
  CANTON_METHOD_LIST_ACCOUNTS,
  CANTON_METHOD_SIGN_MESSAGE,
  CANTON_METHOD_STATUS,
  dispatchProviderRequest,
  type ProviderResponder,
} from '@/provider/dispatch'

const originalFetch = globalThis.fetch

const account = {
  id: 'acct-1',
  name: 'Alice',
  partyId: 'alice::fingerprint',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const captureResponder = (): ProviderResponder & {
  results: unknown[]
  errors: Array<{ code: number; message: string }>
} => {
  const results: unknown[] = []
  const errors: Array<{ code: number; message: string }> = []
  return {
    results,
    errors,
    result: async (value) => {
      results.push(value)
    },
    error: async (code, message) => {
      errors.push({ code, message })
    },
  }
}

const installStatusResponse = (body: unknown): void => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ result: body }), { status: 200 })) as typeof globalThis.fetch
}

const installNetworkFailure = (): void => {
  globalThis.fetch = (async () => {
    throw new Error('offline')
  }) as typeof globalThis.fetch
}

describe('provider request dispatch', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  it('returns CIP-0103 accounts through an injected responder', async () => {
    const responder = captureResponder()

    const result = await dispatchProviderRequest(
      { method: CANTON_METHOD_LIST_ACCOUNTS },
      () => ({ accounts: [account], primary: account }),
      responder,
    )

    assert.deepEqual(result, { status: 'handled' })
    assert.equal(responder.errors.length, 0)
    assert.deepEqual(responder.results, [
      [
        {
          primary: true,
          partyId: 'alice::fingerprint',
          status: 'allocated',
          hint: 'Alice',
          publicKey: 'public-key',
          namespace: 'fingerprint',
          networkId: 'canton:local',
          signingProviderId: 'carpincho-wallet',
        },
      ],
    ])
  })

  it('returns pending approval for signMessage without transport-specific code', async () => {
    const responder = captureResponder()

    const result = await dispatchProviderRequest(
      { method: CANTON_METHOD_SIGN_MESSAGE, params: { message: 'aGVsbG8=' } },
      () => ({ accounts: [account], primary: account }),
      responder,
    )

    assert.deepEqual(result, {
      status: 'pending-approval',
      pendingMethod: CANTON_METHOD_SIGN_MESSAGE,
    })
    assert.equal(responder.results.length, 0)
    assert.equal(responder.errors.length, 0)
  })

  it('returns the active network discovered from wallet-service status', async () => {
    // Scenario: dApps ask Carpincho for the active Canton network, and Carpincho must use
    // wallet-service as the source of truth instead of a manually configured fallback.
    installStatusResponse({
      connection: { isNetworkConnected: true },
      network: { networkId: 'canton:from-status' },
    })
    const responder = captureResponder()

    // Action: dispatch the same JSON-RPC method exposed by wallet-gateway.
    const result = await dispatchProviderRequest(
      { method: CANTON_METHOD_GET_ACTIVE_NETWORK },
      () => ({ accounts: [account], primary: account }),
      responder,
    )

    // Expected result: the response uses the network reported by wallet-service status.
    assert.deepEqual(result, { status: 'handled' })
    assert.equal(responder.errors.length, 0)
    assert.deepEqual(responder.results, [{ networkId: 'canton:from-status' }])
  })

  it('fails getActiveNetwork when wallet-service status is unavailable', async () => {
    // Scenario: no wallet-service status means Carpincho cannot know the active network.
    // This prevents dApps from silently receiving a hard-coded local network.
    installNetworkFailure()
    const responder = captureResponder()

    // Action: ask for active network while wallet-service is unreachable.
    const result = await dispatchProviderRequest(
      { method: CANTON_METHOD_GET_ACTIVE_NETWORK },
      () => ({ accounts: [account], primary: account }),
      responder,
    )

    // Expected result: the provider reports an error and returns no fallback network.
    assert.deepEqual(result, { status: 'error' })
    assert.equal(responder.results.length, 0)
    assert.match(responder.errors[0]?.message ?? '', /wallet-service/i)
  })

  it('does not attach a fallback network to status when wallet-service omits it', async () => {
    // Scenario: wallet-service can answer without a network object, for example while
    // disconnected. Carpincho should pass that shape through instead of inventing one.
    installStatusResponse({ connection: { isNetworkConnected: false, networkReason: 'syncing' } })
    const responder = captureResponder()

    // Action: dispatch status, which is the same discovery path used by wallet-gateway.
    const result = await dispatchProviderRequest(
      { method: CANTON_METHOD_STATUS },
      () => ({ accounts: [account], primary: account }),
      responder,
    )

    // Expected result: status is handled, but the payload has no network field.
    assert.deepEqual(result, { status: 'handled' })
    assert.equal(responder.errors.length, 0)
    assert.equal((responder.results[0] as { network?: unknown }).network, undefined)
  })
})
