// The connect flow: picker to adapter to connected state, and how a refusal surfaces.

import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectCancelledError } from '#src/connectError'
import { useConnect } from '#src/hooks/useConnect'
import { createMockAdapter } from '#src/mock/mockAdapter'
import { createAutoPicker } from '#src/testing/autoPicker'
import { clearDiscoveryStorage } from '#src/testing/discoveryStorage'
import { hangingPicker } from '#src/testing/hangingPicker'
import { renderSession } from '#src/testing/renderSession'
import { throwingPicker } from '#src/testing/throwingPicker'
import { useSession } from '#src/testing/useSession'
import { walletA } from '#src/testing/walletA'

describe('CantonConnectProvider connect flow', () => {
  afterEach(() => {
    clearDiscoveryStorage()
    vi.restoreAllMocks()
  })

  it('connects the announced wallet the picker selects', async () => {
    const wallet = walletA()

    const { result } = renderSession(() => useSession())

    await act(async () => {
      await result.current.connect()
    })

    // connect() resolves when the session lands; the accounts read follows it.
    await waitFor(() => expect(result.current.party?.partyId).toBe('alice::1220ab'))
    expect(result.current.status).toBe('connected')

    wallet.dispose()
  })

  it('connects through the mock adapter with no real wallet installed', async () => {
    const mock = createMockAdapter({ id: 'mock-test', accounts: [{ partyId: 'alice::mock1220' }] })

    const { result } = renderSession(() => useSession(), {
      additionalAdapters: [mock],
      // Selecting by id, not ordering — a real announced wallet could also be in the entries.
      walletPicker: createAutoPicker('mock-test'),
    })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.party?.partyId).toBe('alice::mock1220')
    expect(result.current.status).toBe('connected')
  })

  it('mock party keeps its own networkId even when it disagrees with the config', async () => {
    const mock = createMockAdapter({
      id: 'mock-devnet',
      networkId: 'canton:devnet',
      accounts: [{ partyId: 'alice::mock1220' }],
    })

    const { result } = renderSession(() => useSession(), {
      networkId: 'canton:testnet',
      additionalAdapters: [mock],
      walletPicker: createAutoPicker('mock-devnet'),
    })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.party?.networkId).toBe('canton:devnet')
  })

  it('sets connectError and rejects connect() when the picker throws', async () => {
    const { result } = renderSession(() => useSession(), { walletPicker: throwingPicker })

    // What the message says is toConnectError's classification, owned by connectError.test.ts;
    // here the claim is only that the same thrown value reaches the consumer.
    const rejection = await act(() => result.current.connect().catch((error: unknown) => error))

    expect(rejection).toBeInstanceOf(Error)
    expect(result.current.connectError).toBe(rejection)
    expect(result.current.status).toBe('disconnected')
  })

  it('clears connectError on disconnect', async () => {
    const { result } = renderSession(() => useSession(), { walletPicker: throwingPicker })

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('cancel')
    })

    expect(result.current.connectError?.message).toBe('cancel')

    await act(async () => {
      await result.current.disconnect()
    })

    expect(result.current.connectError).toBeUndefined()
  })

  it('reset() forgets connectError without disconnecting', async () => {
    const { result } = renderSession(() => useConnect(), { walletPicker: throwingPicker })

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('cancel')
    })

    expect(result.current.connectError?.message).toBe('cancel')

    act(() => {
      result.current.reset()
    })

    expect(result.current.connectError).toBeUndefined()

    // still connectable: reset cleared a message, not the machine
    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('cancel')
    })

    expect(result.current.connectError?.message).toBe('cancel')
  })

  // The pair below is the whole observable difference between the two picker configurations: the
  // window.open borrow guardPicker turns on cannot be seen, because jsdom's window.open is an
  // accessor and a spy on it survives the assignment.
  it('runs the consumer picker and opens no popup of its own', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const picker = vi.fn(throwingPicker)

    const { result } = renderSession(() => useSession(), { walletPicker: picker })

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('cancel')
    })

    expect(picker).toHaveBeenCalledTimes(1)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('opens the SDK picker popup when the consumer configures none', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)

    const { result } = renderSession(() => useSession(), { walletPicker: undefined })

    // A popup handle of null is what the SDK's own picker refuses on, which is how this settles.
    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow()
    })

    expect(openSpy).toHaveBeenCalled()
  })

  it('cancels an attempt the wallet never answers', async () => {
    const wallet = walletA()
    const { result } = renderSession(() => useSession(), { walletPicker: hangingPicker })

    let rejection: unknown
    await act(async () => {
      result.current.connect().catch((error: unknown) => {
        rejection = error
      })
    })

    await waitFor(() => expect(result.current.isConnecting).toBe(true))

    await act(async () => {
      result.current.cancelConnect()
    })

    await waitFor(() => expect(result.current.status).toBe('disconnected'))

    expect(rejection).toBeInstanceOf(ConnectCancelledError)
    // a cancel is the user walking away, not a failure, so there is nothing to show them
    expect(result.current.connectError).toBeUndefined()

    wallet.dispose()
  })

  it('retires the sdk a cancelled connect abandoned', async () => {
    const wallet = walletA()
    const { result } = renderSession(() => useSession(), { walletPicker: hangingPicker })
    const abandoned = result.current.sdk

    await act(async () => {
      result.current.connect().catch(() => undefined)
    })

    await act(async () => {
      result.current.cancelConnect()
    })

    await waitFor(() => expect(result.current.sdk).not.toBe(abandoned))

    wallet.dispose()
  })
})
