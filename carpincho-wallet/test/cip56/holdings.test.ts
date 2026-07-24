import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import {
  listTokenHoldingSummaries,
  listTokenHoldings,
  summarizeTokenHoldings,
  type TokenHolding,
  type TokenHoldingSummary,
} from '@/cip56/holdings'

const originalFetch = globalThis.fetch

describe('CIP-56 holding helpers', () => {
  afterEach(() => {
    // Restore the global RPC transport after each scenario so other wallet-service tests
    // keep their own request fixtures isolated.
    globalThis.fetch = originalFetch
  })

  it('lists token holdings through wallet-service without reshaping SDK contracts', async () => {
    // Scenario: wallet-service owns the Node-only SDK call and returns raw-ish
    // holding contracts. Carpincho should preserve that shape at the API boundary.
    const holdings: TokenHolding[] = [
      {
        contractId: 'holding-cid-1',
        interfaceViewValue: {
          owner: 'alice::party',
          amount: '12.5000000000',
          instrumentId: { admin: 'dso::party', id: 'Amulet' },
          lock: null,
        },
      },
    ]
    const methods: string[] = []
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown }
      methods.push(body.method)
      assert.deepEqual(body.params, { partyId: 'alice::party' })
      return new Response(JSON.stringify({ result: holdings }), { status: 200 })
    }

    const result = await listTokenHoldings('alice::party')

    assert.deepEqual(methods, ['cip56.listHoldings'])
    assert.deepEqual(result, holdings)
  })

  it('lists token holding summaries through wallet-service', async () => {
    // Scenario: wallet-service can return Scan-backed balance summaries without
    // sending every UTXO to the browser.
    const summaries: TokenHoldingSummary[] = [
      {
        key: 'dso::party:Amulet',
        tokenLabel: 'Amulet',
        instrumentId: { admin: 'dso::party', id: 'Amulet' },
        totalAmount: '12.5000000000',
        source: 'scan',
      },
    ]
    const methods: string[] = []
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown }
      methods.push(body.method)
      assert.deepEqual(body.params, { partyId: 'alice::party' })
      return new Response(JSON.stringify({ result: summaries }), { status: 200 })
    }

    const result = await listTokenHoldingSummaries('alice::party')

    assert.deepEqual(methods, ['cip56.listHoldingSummary'])
    assert.deepEqual(result, summaries)
  })

  it('summarizes holdings by token with decimal totals and lock counts', () => {
    // Scenario: one party can own multiple holding UTXOs for the same token.
    // The Tokens tab should show a balance-like total while preserving UTXO details.
    const holdings: TokenHolding[] = [
      {
        contractId: 'holding-cid-1',
        interfaceViewValue: {
          owner: 'alice::party',
          amount: '12.5000000000',
          instrumentId: { admin: 'dso::party', id: 'Amulet' },
          lock: null,
        },
      },
      {
        contractId: 'holding-cid-2',
        interfaceViewValue: {
          owner: 'alice::party',
          amount: '3.2500000000',
          instrumentId: { admin: 'dso::party', id: 'Amulet' },
          lock: { holders: ['validator::party'], expiresAt: '2026-06-10T20:41:05.803Z' },
        },
      },
    ]

    const [summary] = summarizeTokenHoldings(holdings)

    assert.equal(summary.tokenLabel, 'Amulet')
    assert.equal(summary.totalAmount, '15.75')
    assert.equal(summary.utxoCount, 2)
    assert.equal(summary.unlockedCount, 1)
    assert.equal(summary.lockedCount, 1)
    assert.deepEqual(
      summary.holdings?.map((holding) => holding.contractId),
      ['holding-cid-1', 'holding-cid-2'],
    )
  })
})
