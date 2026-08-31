import { describe, expect, it } from 'vitest'
import { createMockAdapter } from '#src/mock/mockAdapter'

describe('createMockAdapter', () => {
  it('detects as available with no real wallet installed', async () => {
    const adapter = createMockAdapter()

    expect(await adapter.detect()).toBe(true)
  })

  it('describes itself as a mock so the picker never reads as a real wallet', () => {
    const adapter = createMockAdapter({ id: 'mock-a' })

    const info = adapter.getInfo()

    expect(info.providerId).toBe('mock-a')
    expect(info.name).toMatch(/mock/i)
    expect(info.description).toMatch(/mock/i)
  })

  it('connects and reports connected status', async () => {
    const provider = createMockAdapter().provider()

    const connectResult = await provider.request({ method: 'connect' })
    expect(connectResult.isConnected).toBe(true)

    const status = await provider.request({ method: 'status' })
    expect(status.connection.isConnected).toBe(true)
  })

  it('disconnects back to not connected', async () => {
    const provider = createMockAdapter().provider()
    await provider.request({ method: 'connect' })

    await provider.request({ method: 'disconnect' })

    const status = await provider.request({ method: 'status' })
    expect(status.connection.isConnected).toBe(false)
  })

  it('answers listAccounts with the configured accounts, first entry primary', async () => {
    const provider = createMockAdapter({
      accounts: [{ partyId: 'alice::1220ab', name: 'alice' }, { partyId: 'bob::1220cd' }],
    }).provider()

    const accounts = await provider.request({ method: 'listAccounts' })

    expect(accounts).toHaveLength(2)
    expect(accounts[0]).toMatchObject({ partyId: 'alice::1220ab', primary: true, hint: 'alice' })
    expect(accounts[1]).toMatchObject({ partyId: 'bob::1220cd', primary: false })
  })

  it('falls back to a default account when none are configured', async () => {
    const provider = createMockAdapter({ id: 'mock-b' }).provider()

    const accounts = await provider.request({ method: 'listAccounts' })

    expect(accounts).toHaveLength(1)
    // namespace is what a malformed partyId gives away: it is the fingerprint segment or nothing.
    expect(accounts[0]).toMatchObject({
      partyId: 'mock-b::1220abcd',
      primary: true,
      hint: 'mock-b::1220abcd',
      namespace: '1220abcd',
    })
  })

  it('reaches provider subscribers through emit', () => {
    const adapter = createMockAdapter()
    const provider = adapter.provider()
    const received: unknown[] = []

    provider.on('statusChanged', (payload: unknown) => received.push(payload))
    adapter.emit('statusChanged', { hello: 'world' })

    expect(received).toEqual([{ hello: 'world' }])
  })

  it('stops receiving events after removeListener', () => {
    const adapter = createMockAdapter()
    const provider = adapter.provider()
    const received: unknown[] = []
    const listener = (payload: unknown) => received.push(payload)

    provider.on('statusChanged', listener)
    adapter.emit('statusChanged', { hello: 'world' })
    expect(received).toHaveLength(1)

    provider.removeListener('statusChanged', listener)
    adapter.emit('statusChanged', { hello: 'again' })
    expect(received).toHaveLength(1)
  })

  it('throws naming the method for anything outside the connect flow', async () => {
    const provider = createMockAdapter().provider()

    await expect(provider.request({ method: 'isConnected' })).rejects.toThrow(
      "mock adapter does not implement 'isConnected'",
    )
    await expect(provider.request({ method: 'getActiveNetwork' })).rejects.toThrow(
      "mock adapter does not implement 'getActiveNetwork'",
    )
    await expect(provider.request({ method: 'getPrimaryAccount' })).rejects.toThrow(
      "mock adapter does not implement 'getPrimaryAccount'",
    )
    await expect(
      provider.request({ method: 'prepareExecute', params: { commands: [] } }),
    ).rejects.toThrow("mock adapter does not implement 'prepareExecute'")
    await expect(
      provider.request({ method: 'prepareExecuteAndWait', params: { commands: [] } }),
    ).rejects.toThrow("mock adapter does not implement 'prepareExecuteAndWait'")
    await expect(
      provider.request({ method: 'signMessage', params: { message: 'hi' } }),
    ).rejects.toThrow("mock adapter does not implement 'signMessage'")
    await expect(
      provider.request({
        method: 'ledgerApi',
        params: { requestMethod: 'get', resource: '/v2/parties' },
      }),
    ).rejects.toThrow("mock adapter does not implement 'ledgerApi'")
  })
})
