import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { createDirectProviderResponse } from '@/extension/directProvider'
import type { AccountPublic } from '@/vault/types'

const originalFetch = globalThis.fetch

const account: AccountPublic = {
  id: 'account-1',
  name: 'Primary',
  partyId: 'primary::namespace',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const snapshot = { accounts: [account], primary: account }

describe('extension direct provider handling', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // An unapproved origin must never receive accounts and must not auto-connect.
  it('queues connect for an unapproved origin so the user must approve it', async () => {
    const response = await createDirectProviderResponse(
      { jsonrpc: '2.0', id: 'connect-1', method: 'connect' },
      snapshot,
      { isConnected: false },
    )

    assert.equal(response, undefined)
  })

  it('answers connect with accounts once the origin is connected', async () => {
    const response = await createDirectProviderResponse(
      { jsonrpc: '2.0', id: 'connect-1', method: 'connect' },
      snapshot,
      { isConnected: true },
    )

    assert.equal(response?.id, 'connect-1')
    const result = response?.result as { isConnected?: boolean }
    assert.equal(result.isConnected, true)
  })

  it('leaves connect queued when there is no unlocked wallet snapshot', async () => {
    const response = await createDirectProviderResponse(
      { jsonrpc: '2.0', id: 'connect-1', method: 'connect' },
      null,
      { isConnected: false },
    )

    assert.equal(response, undefined)
  })

  it('does not disclose accounts to an unapproved origin via listAccounts', async () => {
    const response = await createDirectProviderResponse(
      { jsonrpc: '2.0', id: 'list-1', method: 'listAccounts' },
      snapshot,
      { isConnected: false },
    )

    assert.deepEqual(response?.result, [])
  })

  it('returns accounts via listAccounts for a connected origin', async () => {
    const response = await createDirectProviderResponse(
      { jsonrpc: '2.0', id: 'list-1', method: 'listAccounts' },
      snapshot,
      { isConnected: true },
    )

    assert.equal((response?.result as unknown[]).length, 1)
  })

  it('refuses signing from an unapproved origin instead of queuing a prompt', async () => {
    const response = await createDirectProviderResponse(
      {
        jsonrpc: '2.0',
        id: 'tx-1',
        method: 'prepareExecuteAndWait',
        params: { commands: [] },
      },
      snapshot,
      { isConnected: false },
    )

    assert.equal(response?.error?.code, -32000)
    assert.match(response?.error?.message ?? '', /not connected/i)
  })

  it('queues signing for user approval once the origin is connected', async () => {
    const response = await createDirectProviderResponse(
      {
        jsonrpc: '2.0',
        id: 'tx-1',
        method: 'prepareExecuteAndWait',
        params: { commands: [] },
      },
      snapshot,
      { isConnected: true },
    )

    assert.equal(response, undefined)
  })
})
