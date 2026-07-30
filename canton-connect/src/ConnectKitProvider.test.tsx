import type { WalletPickerEntry, WalletPickerFn } from '@canton-network/dapp-sdk'
import { DappSDK } from '@canton-network/dapp-sdk'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import type { JSX } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectKitProvider, useConnectKitContext } from './ConnectKitProvider'
import { createMockAdapter } from './mock/mockAdapter'
import { createAutoPicker } from './testing/autoPicker'
import { createFakeWallet } from './testing/fakeWallet'

const KERNEL_DISCOVERY_KEY = 'splice_wallet_kernel_discovery'
const DISCOVERY_SESSION_KEY = 'splice_discovery_client_session'

// Selecting the entry would start real pairing; capture what was offered and bail.
const capturePicker =
  (offered: WalletPickerEntry[]): WalletPickerFn =>
  async (entries) => {
    offered.push(...entries)
    throw new Error('cancel')
  }

describe('ConnectKitProvider', () => {
  afterEach(() => {
    localStorage.removeItem(KERNEL_DISCOVERY_KEY)
    localStorage.removeItem(DISCOVERY_SESSION_KEY)

    // A prototype spy survives a failed assertion; restoring here keeps it out of later tests.
    vi.restoreAllMocks()
  })

  it('initial state is idle with no party and not locked', () => {
    const config = { appName: 'Test dApp' }
    const { result } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={config}>{children}</ConnectKitProvider>
      ),
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.party).toBe(undefined)
    expect(result.current.isLocked).toBe(false)
  })

  it('useConnectKitContext throws when used outside the provider', () => {
    const Naked = (): JSX.Element => {
      useConnectKitContext()
      return <span />
    }
    expect(() => render(<Naked />)).toThrow(/inside a <ConnectKitProvider>/)
  })

  it('connects the announced wallet the picker selects', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={config}>{children}</ConnectKitProvider>
      ),
    })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.party?.partyId).toBe('alice::1220ab')
    expect(result.current.status).toBe('connected')

    wallet.dispose()
  })

  it('connects through the mock adapter with no real wallet installed', async () => {
    const mock = createMockAdapter({ id: 'mock-test', accounts: [{ partyId: 'alice::mock1220' }] })

    const config = {
      appName: 'test',
      additionalAdapters: [mock],
      // Selecting by id, not ordering — a real announced wallet could also be in the entries.
      walletPicker: createAutoPicker('mock-test'),
    }
    const { result } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={config}>{children}</ConnectKitProvider>
      ),
    })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.party?.partyId).toBe('alice::mock1220')
    expect(result.current.status).toBe('connected')
  })

  it('mock party tracks the configured networkId when the mock sets none', async () => {
    const mock = createMockAdapter({
      id: 'mock-adaptive',
      accounts: [{ partyId: 'alice::mock1220' }],
    })

    const config = {
      appName: 'test',
      networkId: 'canton:testnet',
      additionalAdapters: [mock],
      walletPicker: createAutoPicker('mock-adaptive'),
    }
    const { result } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={config}>{children}</ConnectKitProvider>
      ),
    })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.party?.networkId).toBe('canton:testnet')
  })

  it('mock party keeps its own networkId even when it disagrees with the config', async () => {
    const mock = createMockAdapter({
      id: 'mock-devnet',
      networkId: 'canton:devnet',
      accounts: [{ partyId: 'alice::mock1220' }],
    })

    const config = {
      appName: 'test',
      networkId: 'canton:testnet',
      additionalAdapters: [mock],
      walletPicker: createAutoPicker('mock-devnet'),
    }
    const { result } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={config}>{children}</ConnectKitProvider>
      ),
    })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.party?.networkId).toBe('canton:devnet')
  })

  it('wires events for a restored session even when the wallet reports locked', async () => {
    // Mirrors what a real connect() persists to localStorage, so init() takes the restore path.
    localStorage.setItem(
      KERNEL_DISCOVERY_KEY,
      JSON.stringify({ walletType: 'extension', providerId: 'browser:ext:wallet-a' }),
    )
    localStorage.setItem(
      DISCOVERY_SESSION_KEY,
      JSON.stringify({ providerId: 'browser:ext:wallet-a' }),
    )

    // First status() is the SDK's internal restore check; the second is ours, which finds it locked.
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      statusResponses: [true, false],
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={config}>{children}</ConnectKitProvider>
      ),
    })

    await waitFor(() => expect(result.current.isLocked).toBe(true))
    expect(result.current.status).toBe('connected')
    expect(result.current.party).toBe(undefined)

    act(() => {
      wallet.push('statusChanged', {
        provider: { id: 'wallet-a', providerType: 'browser' },
        connection: { isConnected: true },
      })
    })

    await waitFor(() => expect(result.current.isLocked).toBe(false))

    wallet.dispose()
  })

  it('tears down the previous client listeners before connect() swaps the client', async () => {
    localStorage.setItem(
      KERNEL_DISCOVERY_KEY,
      JSON.stringify({ walletType: 'extension', providerId: 'browser:ext:wallet-a' }),
    )
    localStorage.setItem(
      DISCOVERY_SESSION_KEY,
      JSON.stringify({ providerId: 'browser:ext:wallet-a' }),
    )

    // Restore's internal check sees connected, our own check finds it locked, connect()'s own
    // check (against the swapped-in client) sees connected again.
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      statusResponses: [true, false, true],
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={config}>{children}</ConnectKitProvider>
      ),
    })

    await waitFor(() => expect(result.current.isLocked).toBe(true))

    // connect() replaces sdk's internal client with a new one; teardown must run against the
    // old client first, or removeOnAccountsChanged ends up targeting the wrong client.
    const removeSpy = vi.spyOn(result.current.sdk, 'removeOnAccountsChanged')
    const connectSpy = vi.spyOn(result.current.sdk, 'connect')

    await act(async () => {
      await result.current.connect()
    })

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy.mock.invocationCallOrder[0]).toBeLessThan(
      connectSpy.mock.invocationCallOrder[0],
    )

    wallet.dispose()
  })

  it('offers a WalletConnect entry when a project id is configured', async () => {
    const offered: WalletPickerEntry[] = []

    const config = {
      appName: 'test',
      walletConnectProjectId: 'test-project',
      walletPicker: capturePicker(offered),
    }
    const { result } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={config}>{children}</ConnectKitProvider>
      ),
    })

    await act(async () => {
      await result.current.connect().catch(() => undefined)
    })

    expect(offered).toEqual([
      expect.objectContaining({ providerId: 'walletconnect', type: 'mobile' }),
    ])
  })

  it('offers no WalletConnect entry without a project id', async () => {
    const offered: WalletPickerEntry[] = []

    const config = { appName: 'test', walletPicker: capturePicker(offered) }
    const { result } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={config}>{children}</ConnectKitProvider>
      ),
    })

    await act(async () => {
      await result.current.connect().catch(() => undefined)
    })

    expect(offered).toEqual([])
  })

  it('does not re-init when a rerender passes a new config object with the same field values', async () => {
    const initSpy = vi.spyOn(DappSDK.prototype, 'init')

    // Hoisted so this reference stays stable across renders — only the wrapping config object is fresh.
    const walletPicker = createAutoPicker()

    const { rerender } = renderHook(() => useConnectKitContext(), {
      wrapper: ({ children }) => (
        <ConnectKitProvider config={{ appName: 'test', walletPicker }}>
          {children}
        </ConnectKitProvider>
      ),
    })

    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1))

    rerender()

    expect(initSpy).toHaveBeenCalledTimes(1)
  })
})
