import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useWalletServiceTest } from '@/hooks/useWalletServiceTest'

const originalFetch = globalThis.fetch

const respond = (result: unknown): void => {
  globalThis.fetch = async () => new Response(JSON.stringify({ result }), { status: 200 })
}

describe('useWalletServiceTest', () => {
  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it('maps a connected status to connected with the network id', async () => {
    respond({ connection: { isNetworkConnected: true }, network: { networkId: 'canton:local' } })
    const { result } = renderHook(() => useWalletServiceTest())
    await act(async () => {
      await result.current.test('http://host/rpc')
    })
    assert.equal(result.current.state, 'connected')
    assert.equal(result.current.networkId, 'canton:local')
    assert.equal(result.current.testedUrl, 'http://host/rpc')
  })

  it('maps a responded-but-not-connected status to unreachable with the reason', async () => {
    respond({ connection: { isNetworkConnected: false, networkReason: 'syncing' } })
    const { result } = renderHook(() => useWalletServiceTest())
    await act(async () => {
      await result.current.test('http://host/rpc')
    })
    assert.equal(result.current.state, 'unreachable')
    assert.equal(result.current.reason, 'syncing')
    assert.equal(result.current.testedUrl, 'http://host/rpc')
  })

  it('maps a thrown request to unreachable with the error message', async () => {
    globalThis.fetch = async () => {
      throw new Error('Failed to fetch')
    }
    const { result } = renderHook(() => useWalletServiceTest())
    await act(async () => {
      await result.current.test('http://host/rpc')
    })
    assert.equal(result.current.state, 'unreachable')
    assert.equal(result.current.reason, 'Failed to fetch')
    assert.equal(result.current.testedUrl, 'http://host/rpc')
  })

  it('ignores a superseded probe and keeps only the latest result', async () => {
    let resolveFirst: (value: Response) => void = () => undefined
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve
    })
    let call = 0
    globalThis.fetch = (async () => {
      call += 1
      if (call === 1) {
        return await firstResponse
      }
      return new Response(
        JSON.stringify({
          result: {
            connection: { isNetworkConnected: true },
            network: { networkId: 'canton:local' },
          },
        }),
        { status: 200 },
      )
    }) as typeof fetch

    const { result } = renderHook(() => useWalletServiceTest())
    await act(async () => {
      const stale = result.current.test('http://stale/rpc')
      const fresh = result.current.test('http://fresh/rpc')
      await fresh
      resolveFirst(
        new Response(
          JSON.stringify({
            result: { connection: { isNetworkConnected: false, networkReason: 'old' } },
          }),
          {
            status: 200,
          },
        ),
      )
      await stale
    })

    assert.equal(result.current.state, 'connected')
    assert.equal(result.current.networkId, 'canton:local')
    assert.equal(result.current.testedUrl, 'http://fresh/rpc')
  })
})
