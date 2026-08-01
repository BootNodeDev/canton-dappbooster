import type { WalletPickerEntry, WalletPickerFn } from '@canton-network/dapp-sdk'
import { DappSDK, UserRejectedError } from '@canton-network/dapp-sdk'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import type { JSX } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CantonConnectProvider, useCantonConnectContext } from './CantonConnectProvider'
import { clearConnectedWallet, readConnectedWallet, writeConnectedWallet } from './connectedWallet'
import { useConnect } from './hooks/useConnect'
import { useExecute } from './hooks/useExecute'
import { useLedger } from './hooks/useLedger'
import { useParties } from './hooks/useParties'
import { useParty } from './hooks/useParty'
import { useSignMessage } from './hooks/useSignMessage'
import { useWalletPicker } from './hooks/useWalletPicker'
import { useWalletStatus } from './hooks/useWalletStatus'
import { createMockAdapter } from './mock/mockAdapter'
import { createAutoPicker } from './testing/autoPicker'
import { createFakeWallet } from './testing/fakeWallet'

const KERNEL_DISCOVERY_KEY = 'splice_wallet_kernel_discovery'
const DISCOVERY_SESSION_KEY = 'splice_discovery_client_session'
const SUGGESTED_ENTRIES_KEY = 'splice_wallet_picker_suggested_entries'
const RECENT_GATEWAYS_KEY = 'splice_wallet_picker_recent'

// Selecting the entry would start real pairing; capture what was offered and bail.
const capturePicker =
  (offered: WalletPickerEntry[]): WalletPickerFn =>
  async (entries) => {
    offered.push(...entries)
    throw new Error('cancel')
  }

const throwingPicker: WalletPickerFn = async () => {
  throw new Error('cancel')
}

describe('CantonConnectProvider', () => {
  afterEach(() => {
    localStorage.removeItem(KERNEL_DISCOVERY_KEY)
    localStorage.removeItem(DISCOVERY_SESSION_KEY)
    localStorage.removeItem(SUGGESTED_ENTRIES_KEY)
    localStorage.removeItem(RECENT_GATEWAYS_KEY)
    clearConnectedWallet()

    // A prototype spy survives a failed assertion; restoring here keeps it out of later tests.
    vi.restoreAllMocks()
  })

  it('initial state is idle with no party and not locked', () => {
    const config = { appName: 'Test dApp' }
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.party).toBe(undefined)
    expect(result.current.isLocked).toBe(false)
  })

  it('useCantonConnectContext throws when used outside the provider', () => {
    const Naked = (): JSX.Element => {
      useCantonConnectContext()
      return <span />
    }
    expect(() => render(<Naked />)).toThrow(/inside a <CantonConnectProvider>/)
  })

  it('connects the announced wallet the picker selects', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect()
    })

    wallet.dispose()

    expect(result.current.party?.partyId).toBe('alice::1220ab')
    expect(result.current.status).toBe('connected')
  })

  it('connects through the mock adapter with no real wallet installed', async () => {
    const mock = createMockAdapter({ id: 'mock-test', accounts: [{ partyId: 'alice::mock1220' }] })

    const config = {
      appName: 'test',
      additionalAdapters: [mock],
      // Selecting by id, not ordering — a real announced wallet could also be in the entries.
      walletPicker: createAutoPicker('mock-test'),
    }
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
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
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
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
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
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
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(result.current.isLocked).toBe(true))
    expect(result.current.status).toBe('connected')
    expect(result.current.party).toBe(undefined)

    act(() => {
      wallet.push('statusChanged', {
        provider: { id: 'wallet-a', providerType: 'browser' },
        connection: { isConnected: true, isNetworkConnected: true },
      })
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    await waitFor(() => expect(result.current.isLocked).toBe(false))
  })

  it('clears isLocked when connect() succeeds after a locked session was restored', async () => {
    localStorage.setItem(
      KERNEL_DISCOVERY_KEY,
      JSON.stringify({ walletType: 'extension', providerId: 'browser:ext:wallet-a' }),
    )
    localStorage.setItem(
      DISCOVERY_SESSION_KEY,
      JSON.stringify({ providerId: 'browser:ext:wallet-a' }),
    )

    // Restore's own check sees connected, ours finds it locked, connect()'s sees connected again.
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      statusResponses: [true, false, true],
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(result.current.isLocked).toBe(true))

    await act(async () => {
      await result.current.connect()
    })

    wallet.dispose()

    expect(result.current.isLocked).toBe(false)
    expect(result.current.party?.partyId).toBe('alice::1220ab')
  })

  it('lands disconnected, with the wiring gone, when a restored session cannot read accounts', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-badread',
      target: 'wallet-badread',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    // Connect once so a session exists to restore.
    const config = { appName: 'test', walletPicker: createAutoPicker('browser:ext:wallet-badread') }
    const first = renderHook(() => useConnect(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await first.result.current.connect()
    })

    first.unmount()

    vi.spyOn(DappSDK.prototype, 'listAccounts').mockRejectedValue(new Error('read exploded'))

    const { result } = renderHook(() => ({ connect: useConnect(), party: useParty() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(result.current.connect.connectError?.message).toBe('read exploded'))
    expect(result.current.party.status).toBe('disconnected')
    expect(result.current.party.party).toBe(undefined)

    act(() => {
      wallet.push('accountsChanged', [{ partyId: 'carol::9', primary: true, status: 'allocated' }])
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    // The wiring went up before the read; rejecting proves it came down when the read failed.
    await expect(
      waitFor(() => expect(result.current.party.party?.partyId).toBe('carol::9')),
    ).rejects.toThrow()
  })

  it('tears down the wiring when the session vanishes between connect() and the account read', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-vanish',
      target: 'wallet-vanish',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    // connect() itself succeeds; the account read then fails and the probe finds no session left.
    vi.spyOn(DappSDK.prototype, 'listAccounts').mockRejectedValue(new Error('read exploded'))
    vi.spyOn(DappSDK.prototype, 'status').mockRejectedValue(new Error('no session'))

    const config = { appName: 'test', walletPicker: createAutoPicker('browser:ext:wallet-vanish') }
    const { result } = renderHook(() => ({ connect: useConnect(), party: useParty() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await expect(result.current.connect.connect()).rejects.toThrow('read exploded')
    })

    expect(result.current.party.status).toBe('disconnected')

    act(() => {
      wallet.push('accountsChanged', [{ partyId: 'carol::9', primary: true, status: 'allocated' }])
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    // The wiring went up after connect() succeeded; rejecting proves the no-session reset took it down.
    await expect(
      waitFor(() => expect(result.current.party.party?.partyId).toBe('carol::9')),
    ).rejects.toThrow()

    expect(result.current.party.party).toBe(undefined)
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

    // Status calls: restore's check, ours (finds it locked), connect()'s on the swapped-in client.
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      statusResponses: [true, false, true],
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(result.current.isLocked).toBe(true))

    // connect() swaps the client; teardown must run first, or the remove lands on the wrong client.
    const removeSpy = vi.spyOn(result.current.sdk, 'removeOnAccountsChanged')
    const connectSpy = vi.spyOn(result.current.sdk, 'connect')

    await act(async () => {
      await result.current.connect()
    })

    wallet.dispose()

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy.mock.invocationCallOrder[0]).toBeLessThan(
      connectSpy.mock.invocationCallOrder[0],
    )
  })

  it('returns the in-flight attempt instead of starting a second connect', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-reentrant',
      target: 'wallet-reentrant',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    // Announced wallets surface in the picker as browser:ext:<id>.
    const config = {
      appName: 'test',
      walletPicker: createAutoPicker('browser:ext:wallet-reentrant'),
    }
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    const connectSpy = vi.spyOn(result.current.sdk, 'connect')

    await act(async () => {
      const first = result.current.connect()
      const second = result.current.connect()

      // Identity, not equivalence: an async wrapper re-wraps the shared promise per caller.
      expect(second).toBe(first)

      await Promise.all([first, second])
    })

    wallet.dispose()

    expect(connectSpy).toHaveBeenCalledTimes(1)
    expect(result.current.party?.partyId).toBe('alice::1')
  })

  it('leaves no orphaned wiring when connect() overlaps an in-flight connect', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-overlap',
      target: 'wallet-overlap',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker('browser:ext:wallet-overlap') }
    const { result } = renderHook(() => ({ connect: useConnect(), party: useParty() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      const first = result.current.connect.connect()
      const second = result.current.connect.connect()
      await Promise.all([first, second])
    })

    expect(result.current.party.party?.partyId).toBe('alice::1')

    await act(async () => {
      await result.current.connect.disconnect()
    })

    act(() => {
      wallet.push('accountsChanged', [{ partyId: 'carol::9', primary: true, status: 'allocated' }])
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    // Rejecting proves no wiring survived the disconnect — a leaked listener would deliver the push.
    await expect(
      waitFor(() => expect(result.current.party.party?.partyId).toBe('carol::9')),
    ).rejects.toThrow()

    expect(result.current.party.party).toBe(undefined)
  })

  it('keeps delivering events to useParty() after a throwing picker rejects connect() on a restored session', async () => {
    localStorage.setItem(
      KERNEL_DISCOVERY_KEY,
      JSON.stringify({ walletType: 'extension', providerId: 'browser:ext:wallet-a' }),
    )
    localStorage.setItem(
      DISCOVERY_SESSION_KEY,
      JSON.stringify({ providerId: 'browser:ext:wallet-a' }),
    )

    // Restore's check, ours, and the post-failure probe all see the same live, connected client.
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      statusResponses: [true, true, true],
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: throwingPicker }
    const { result } = renderHook(() => ({ connect: useConnect(), party: useParty() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(result.current.party.party?.partyId).toBe('alice::1220ab'))
    expect(result.current.party.status).toBe('connected')

    // sdk.connect() rejects before it ever swaps its client — the restored session survives.
    await act(async () => {
      await expect(result.current.connect.connect()).rejects.toThrow('cancel')
    })

    expect(result.current.party.party?.partyId).toBe('alice::1220ab')

    act(() => {
      wallet.push('accountsChanged', [
        {
          partyId: 'bob::9931cd',
          primary: true,
          hint: 'bob',
          publicKey: 'pub-bob',
          networkId: 'canton:local',
        },
      ])
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    await waitFor(() => expect(result.current.party.party?.partyId).toBe('bob::9931cd'))
  })

  it('sets connectError and rejects connect() when the picker throws', async () => {
    const config = { appName: 'test', walletPicker: throwingPicker }
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('cancel')
    })

    expect(result.current.connectError?.message).toBe('cancel')
    expect(result.current.status).toBe('disconnected')
  })

  it('keeps the original connect error when the recovery read also fails', async () => {
    localStorage.setItem(
      KERNEL_DISCOVERY_KEY,
      JSON.stringify({ walletType: 'extension', providerId: 'browser:ext:wallet-a' }),
    )
    localStorage.setItem(
      DISCOVERY_SESSION_KEY,
      JSON.stringify({ providerId: 'browser:ext:wallet-a' }),
    )

    // Restore's internal check, our restore check, and the post-failure probe all see a live session.
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      statusResponses: [true, true, true],
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: throwingPicker }
    const { result } = renderHook(() => ({ connect: useConnect(), party: useParty() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(result.current.party.party?.partyId).toBe('alice::1220ab'))

    // The recovery's own account read fails too — its error must not replace the picker's.
    vi.spyOn(DappSDK.prototype, 'listAccounts').mockRejectedValue(new Error('read exploded'))

    await act(async () => {
      await expect(result.current.connect.connect()).rejects.toThrow('cancel')
    })

    // The wallet's part is over; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    expect(result.current.connect.connectError?.message).toBe('cancel')
    expect(result.current.party.status).toBe('disconnected')
  })

  it('clears a previous connect error on disconnect()', async () => {
    const config = { appName: 'test', walletPicker: throwingPicker }
    const { result } = renderHook(() => useConnect(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('cancel')
    })

    expect(result.current.connectError?.message).toBe('cancel')

    await act(async () => {
      await result.current.disconnect()
    })

    expect(result.current.connectError).toBe(undefined)
  })

  it('surfaces an init failure instead of sitting idle', async () => {
    vi.spyOn(DappSDK.prototype, 'init').mockRejectedValue(new Error('init exploded'))

    const config = { appName: 'test' }
    const { result } = renderHook(() => ({ connect: useConnect(), party: useParty() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(result.current.connect.connectError?.message).toBe('init exploded'))
    expect(result.current.party.status).toBe('disconnected')
  })

  it('offers a WalletConnect entry when a project id is configured', async () => {
    const offered: WalletPickerEntry[] = []

    const config = {
      appName: 'test',
      walletConnectProjectId: 'test-project',
      walletPicker: capturePicker(offered),
    }
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
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
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect().catch(() => undefined)
    })

    expect(offered).toEqual([])
  })

  it('does not re-init when a rerender passes a new config object with the same field values', async () => {
    const initSpy = vi.spyOn(DappSDK.prototype, 'init')

    // Hoisted so the reference stays stable across renders; only the wrapping config object is fresh.
    const walletPicker = createAutoPicker()

    const { rerender } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={{ appName: 'test', walletPicker }}>
          {children}
        </CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1))

    rerender()

    expect(initSpy).toHaveBeenCalledTimes(1)
  })

  it('keeps one SDK instance and a single init() across rerenders in in-page mode', async () => {
    const initSpy = vi.spyOn(DappSDK.prototype, 'init')

    // Config inline on purpose: field-stable but identity-fresh every render, like a real JSX literal.
    const { result, rerender } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={{ appName: 'test', walletSelection: 'in-page' }}>
          {children}
        </CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1))
    const initialSdk = result.current.sdk

    rerender()
    rerender()

    // Identity pins the sdk memo; the init count pins the mount effect's dependency stability.
    expect(result.current.sdk).toBe(initialSdk)
    expect(initSpy).toHaveBeenCalledTimes(1)
  })

  it('resets to disconnected when a rerender with an inline walletPicker replaces the SDK mid-session', async () => {
    const mock = createMockAdapter({ id: 'mock-swap', accounts: [{ partyId: 'alice::mock1220' }] })

    // walletPicker built inline per render: every rerender swaps in a brand-new SDK instance.
    const { result, rerender } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider
          config={{
            appName: 'test',
            additionalAdapters: [mock],
            walletPicker: createAutoPicker('mock-swap'),
          }}
        >
          {children}
        </CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.status).toBe('connected')
    const replacedSdk = result.current.sdk

    rerender()

    expect(result.current.sdk).not.toBe(replacedSdk)

    // The replacement instance restores no session; the replaced instance's state must not survive it.
    await waitFor(() => expect(result.current.status).toBe('disconnected'))
    expect(result.current.party).toBe(undefined)
    expect(result.current.wallet).toBe(undefined)
  })

  it('keeps a StrictMode first mount idle when no session restores', async () => {
    writeConnectedWallet({ providerId: 'ghost', name: 'Ghost' })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
      reactStrictMode: true,
    })

    // The ghost record vanishing proves the mount probe ran and found nothing to restore.
    await waitFor(() => expect(readConnectedWallet()).toBe(undefined))

    // StrictMode's second effect run hits the same instance — a re-run, never a replacement.
    expect(result.current.status).toBe('idle')
  })

  it('delivers a pushed accountsChanged event to useParty()', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => ({ connect: useConnect(), party: useParty() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect.connect()
    })

    expect(result.current.party.party?.partyId).toBe('alice::1220ab')

    act(() => {
      wallet.push('accountsChanged', [
        {
          partyId: 'bob::9931cd',
          primary: true,
          hint: 'bob',
          publicKey: 'pub-bob',
          networkId: 'canton:local',
        },
      ])
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    await waitFor(() => expect(result.current.party.party?.partyId).toBe('bob::9931cd'))
    expect(result.current.party.party?.name).toBe('bob')
  })

  it('flips useWalletStatus().isLocked when a statusChanged push reports the wallet disconnected', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => ({ connect: useConnect(), status: useWalletStatus() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect.connect()
    })

    expect(result.current.status.isLocked).toBe(false)

    act(() => {
      wallet.push('statusChanged', {
        provider: { id: 'wallet-a', providerType: 'browser' },
        // Network stays up; only the wallet locks — proves the handler keys on isConnected alone.
        connection: { isConnected: false, isNetworkConnected: true },
      })
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    await waitFor(() => expect(result.current.status.isLocked).toBe(true))
  })

  it('advances useExecute().lastTx through a pending then executed txChanged push', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => ({ connect: useConnect(), execute: useExecute() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect.connect()
    })

    act(() => {
      wallet.push('txChanged', { status: 'pending', commandId: 'cmd-1' })
    })

    await waitFor(() => expect(result.current.execute.lastTx?.status).toBe('pending'))
    expect(result.current.execute.lastTx?.payload).toBe(undefined)

    act(() => {
      wallet.push('txChanged', {
        status: 'executed',
        commandId: 'cmd-1',
        payload: { updateId: 'update-1', completionOffset: 42 },
      })
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    await waitFor(() => expect(result.current.execute.lastTx?.status).toBe('executed'))
    expect(result.current.execute.lastTx?.payload).toEqual({
      updateId: 'update-1',
      completionOffset: 42,
    })
  })

  it('stops applying pushed events to the hooks after disconnect()', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result } = renderHook(() => ({ connect: useConnect(), party: useParty() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect.connect()
    })

    expect(result.current.party.party?.partyId).toBe('alice::1220ab')

    await act(async () => {
      await result.current.connect.disconnect()
    })

    expect(result.current.party.party).toBe(undefined)

    act(() => {
      wallet.push('accountsChanged', [
        {
          partyId: 'carol::deadbeef',
          primary: true,
          hint: 'carol',
          publicKey: 'pub-carol',
          networkId: 'canton:local',
        },
      ])
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    // waitFor exhausts its retry window; rejecting proves the change never arrived.
    await expect(
      waitFor(() => expect(result.current.party.party?.partyId).toBe('carol::deadbeef')),
    ).rejects.toThrow()

    expect(result.current.party.party).toBe(undefined)
  })

  it('tears down listeners when the provider unmounts', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletPicker: createAutoPicker() }
    const { result, unmount } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect()
    })

    wallet.dispose()

    const removeSpy = vi.spyOn(result.current.sdk, 'removeOnAccountsChanged')

    unmount()

    expect(removeSpy).toHaveBeenCalledTimes(1)
  })

  it('useSignMessage throws its not-connected guard before connecting', async () => {
    const config = { appName: 'test' }
    const { result } = renderHook(() => useSignMessage(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await expect(result.current.signMessage('hello')).rejects.toThrow(
      'wallet is not connected — call useConnect().connect() first',
    )
  })

  it('useLedger throws its not-connected guard before connecting', async () => {
    const config = { appName: 'test' }
    const { result } = renderHook(() => useLedger(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await expect(
      result.current.ledgerApi({ requestMethod: 'get', resource: '/v2/parties' }),
    ).rejects.toThrow('wallet is not connected — call useConnect().connect() first')
  })

  it('sets useExecute().error on a failing execute and clears it on reset()', async () => {
    const mock = createMockAdapter({
      id: 'mock-execute',
      accounts: [{ partyId: 'alice::mock1220' }],
    })

    const config = {
      appName: 'test',
      additionalAdapters: [mock],
      walletPicker: createAutoPicker('mock-execute'),
    }
    const { result } = renderHook(() => ({ connect: useConnect(), execute: useExecute() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect.connect()
    })

    // The mock only answers the connect flow — prepareExecuteAndWait throws naming itself.
    await act(async () => {
      await expect(result.current.execute.execute({ commands: [] })).rejects.toThrow(
        "mock adapter does not implement 'prepareExecuteAndWait'",
      )
    })

    expect(result.current.execute.error?.message).toBe(
      "mock adapter does not implement 'prepareExecuteAndWait'",
    )

    act(() => {
      result.current.execute.reset()
    })

    expect(result.current.execute.error).toBe(undefined)
  })

  it('exposes every usable party through useParties(), primary first', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-parties',
      target: 'wallet-parties',
      accounts: [
        { partyId: 'bob::2', status: 'allocated' },
        { partyId: 'alice::1', status: 'allocated', primary: true },
        { partyId: 'pending::3', status: 'initialized' },
      ],
    })

    // Announced wallets surface in the picker as browser:ext:<id>.
    const config = { appName: 'test', walletPicker: createAutoPicker('browser:ext:wallet-parties') }
    const { result } = renderHook(
      () => ({ connect: useConnect(), parties: useParties(), party: useParty() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    await act(async () => {
      await result.current.connect.connect()
    })

    wallet.dispose()

    expect(result.current.parties.parties.map((party) => party.partyId)).toEqual([
      'alice::1',
      'bob::2',
    ])
    expect(result.current.party.party?.partyId).toBe('alice::1')
    // The invariant consumers lean on: party is always parties[0].
    expect(result.current.party.party).toEqual(result.current.parties.parties[0])
  })

  it('an accountsChanged push updates useParties(), not only useParty()', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-push-parties',
      target: 'wallet-push-parties',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = {
      appName: 'test',
      walletPicker: createAutoPicker('browser:ext:wallet-push-parties'),
    }
    const { result } = renderHook(() => ({ connect: useConnect(), parties: useParties() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect.connect()
    })

    act(() => {
      wallet.push('accountsChanged', [
        { partyId: 'carol::9', primary: true, status: 'allocated' },
        { partyId: 'dave::8', status: 'allocated' },
        { partyId: 'nope::7', status: 'removed' },
      ])
    })

    // The push is already in flight; dispose now so a failure below can't leak the announce listener.
    wallet.dispose()

    await waitFor(() =>
      expect(result.current.parties.parties.map((party) => party.partyId)).toEqual([
        'carol::9',
        'dave::8',
      ]),
    )
  })

  it('empties useParties() on disconnect', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-parties-off',
      target: 'wallet-parties-off',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = {
      appName: 'test',
      walletPicker: createAutoPicker('browser:ext:wallet-parties-off'),
    }
    const { result } = renderHook(() => ({ connect: useConnect(), parties: useParties() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect.connect()
    })
    expect(result.current.parties.parties).toHaveLength(1)

    await act(async () => {
      await result.current.connect.disconnect()
    })

    wallet.dispose()

    expect(result.current.parties.parties).toEqual([])
  })

  it('publishes the offered wallets in in-page mode and connects the one select() picks', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-inpage',
      target: 'wallet-inpage',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result } = renderHook(
      () => ({ connect: useConnect(), picker: useWalletPicker(), party: useParty() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    let attempt: Promise<void> | undefined
    act(() => {
      attempt = result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.picker.isOpen).toBe(true))

    // Announced wallets surface in the picker as browser:ext:<id>.
    expect(result.current.picker.wallets.map((entry) => entry.providerId)).toContain(
      'browser:ext:wallet-inpage',
    )

    await act(async () => {
      result.current.picker.select('browser:ext:wallet-inpage')
      await attempt
    })

    wallet.dispose()

    expect(result.current.picker.isOpen).toBe(false)
    expect(result.current.picker.wallets).toEqual([])
    expect(result.current.party.party?.partyId).toBe('alice::1')
  })

  it('never opens a choice when in-page selection is off', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-popupmode',
      target: 'wallet-popupmode',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = {
      appName: 'test',
      walletPicker: createAutoPicker('browser:ext:wallet-popupmode'),
    }
    const { result } = renderHook(() => ({ connect: useConnect(), picker: useWalletPicker() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await act(async () => {
      await result.current.connect.connect()
    })

    wallet.dispose()

    expect(result.current.connect.isConnected).toBe(true)
    expect(result.current.picker.isOpen).toBe(false)
    expect(result.current.picker.wallets).toEqual([])
  })

  it('keeps an explicit walletPicker in charge even when in-page mode is on', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-precedence',
      target: 'wallet-precedence',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = {
      appName: 'test',
      walletSelection: 'in-page' as const,
      walletPicker: createAutoPicker('browser:ext:wallet-precedence'),
    }
    const { result } = renderHook(() => ({ connect: useConnect(), picker: useWalletPicker() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    // Resolving without select() ever being called proves the explicit picker answered.
    await act(async () => {
      await result.current.connect.connect()
    })

    wallet.dispose()

    expect(result.current.connect.isConnected).toBe(true)
    expect(result.current.picker.isOpen).toBe(false)
  })

  it('rejects the choice, naming the id, when select() is given an unoffered wallet', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-badselect',
      target: 'wallet-badselect',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result } = renderHook(() => ({ connect: useConnect(), picker: useWalletPicker() }), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    let attempt: Promise<void> | undefined
    act(() => {
      attempt = result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.picker.isOpen).toBe(true))

    // A consumer bug, not a user cancellation — the rejection must name the id.
    await act(async () => {
      result.current.picker.select('not-offered')
      await expect(attempt).rejects.toThrow(/not-offered/)
    })

    wallet.dispose()

    expect(result.current.picker.isOpen).toBe(false)
    expect(result.current.connect.isConnecting).toBe(false)
    expect(result.current.connect.connectError?.message).toContain('not-offered')
  })

  it('settles the attempt when the user cancels the choice, and a retry then connects', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-cancel',
      target: 'wallet-cancel',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result } = renderHook(
      () => ({ connect: useConnect(), picker: useWalletPicker(), party: useParty() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    let attempt: Promise<void> | undefined
    act(() => {
      attempt = result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.picker.isOpen).toBe(true))

    await act(async () => {
      // Handler attached before the cancel, so the rejection can never land unhandled.
      const settled = expect(attempt).rejects.toBeInstanceOf(UserRejectedError)
      result.current.picker.cancel()
      await settled
    })

    expect(result.current.connect.isConnecting).toBe(false)
    expect(result.current.connect.connectError).toBeInstanceOf(UserRejectedError)
    expect(result.current.picker.isOpen).toBe(false)

    // The same provider must be able to try again without a remount.
    let retry: Promise<void> | undefined
    act(() => {
      retry = result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.picker.isOpen).toBe(true))

    await act(async () => {
      // Announced wallets surface in the picker as browser:ext:<id>.
      result.current.picker.select('browser:ext:wallet-cancel')
      await retry
    })

    wallet.dispose()

    expect(result.current.party.party?.partyId).toBe('alice::1')
    expect(result.current.connect.connectError).toBe(undefined)
  })

  it('disconnect() during a pending choice ends disconnected with no error, no party, no open choice', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-disc-choice',
      target: 'wallet-disc-choice',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result } = renderHook(
      () => ({ connect: useConnect(), picker: useWalletPicker(), party: useParty() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    act(() => {
      // The killed attempt is asserted through state below; the handler keeps its rejection contained.
      result.current.connect.connect().catch(() => undefined)
    })

    await waitFor(() => expect(result.current.picker.isOpen).toBe(true))

    await act(async () => {
      await result.current.connect.disconnect()
    })

    wallet.dispose()

    // disconnect() owns the end state: the killed attempt must not have written after it finished.
    expect(result.current.party.status).toBe('disconnected')
    expect(result.current.connect.connectError).toBe(undefined)
    expect(result.current.party.party).toBe(undefined)
    expect(result.current.picker.isOpen).toBe(false)
  })

  it('ends disconnected when disconnect() lands before the choice has opened', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-early-disc',
      target: 'wallet-early-disc',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result } = renderHook(
      () => ({ connect: useConnect(), picker: useWalletPicker(), party: useParty() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    await act(async () => {
      // Same synchronous breath: the SDK has not offered the choice yet when disconnect() starts.
      const attempt = result.current.connect.connect()
      const settled = expect(attempt).rejects.toBeInstanceOf(UserRejectedError)
      await result.current.connect.disconnect()
      await settled
    })

    wallet.dispose()

    expect(result.current.party.status).toBe('disconnected')
    expect(result.current.connect.connectError).toBe(undefined)
    expect(result.current.picker.isOpen).toBe(false)
  })

  it('unmounting during a pending choice settles the attempt without an unhandled rejection', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-unmount-choice',
      target: 'wallet-unmount-choice',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result, unmount } = renderHook(
      () => ({ connect: useConnect(), picker: useWalletPicker() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    let attempt: Promise<void> | undefined
    act(() => {
      attempt = result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.picker.isOpen).toBe(true))

    // Only the pending choice keeps the attempt alive now — the wallet's part is over.
    wallet.dispose()

    const settled = expect(attempt).rejects.toBeInstanceOf(UserRejectedError)
    unmount()
    await settled
  })

  it('reports the chosen wallet, and still reports it after a remount with the session alive', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-named',
      name: 'Wallet Named',
      target: 'wallet-named',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const first = renderHook(
      () => ({ connect: useConnect(), picker: useWalletPicker(), party: useParty() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    let attempt: Promise<void> | undefined
    act(() => {
      attempt = first.result.current.connect.connect()
    })

    await waitFor(() => expect(first.result.current.picker.isOpen).toBe(true))

    await act(async () => {
      // Announced wallets surface in the picker as browser:ext:<id>.
      first.result.current.picker.select('browser:ext:wallet-named')
      await attempt
    })

    expect(first.result.current.party.wallet).toEqual({
      providerId: 'browser:ext:wallet-named',
      name: 'Wallet Named',
    })

    first.unmount()

    // The second mount restores the session from the SDK's storage; the record names its wallet.
    const second = renderHook(() => useParty(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(second.result.current.wallet).toBeDefined())

    wallet.dispose()

    expect(second.result.current.wallet).toEqual({
      providerId: 'browser:ext:wallet-named',
      name: 'Wallet Named',
    })
  })

  it('reports the wallet a supplied walletPicker returns, with no in-page choice opening', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-supplied',
      name: 'Wallet Supplied',
      target: 'wallet-supplied',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = {
      appName: 'test',
      walletPicker: createAutoPicker('browser:ext:wallet-supplied'),
    }
    const { result } = renderHook(
      () => ({ connect: useConnect(), picker: useWalletPicker(), party: useParty() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    await act(async () => {
      await result.current.connect.connect()
    })

    wallet.dispose()

    // The supplied function owns the interaction; wrapping it must not publish a pending choice.
    expect(result.current.picker.isOpen).toBe(false)
    expect(result.current.party.wallet).toEqual({
      providerId: 'browser:ext:wallet-supplied',
      name: 'Wallet Supplied',
    })
  })

  it('forgets the wallet when no session is restored', async () => {
    writeConnectedWallet({ providerId: 'ghost', name: 'Ghost' })

    const config = { appName: 'test' }
    const { result } = renderHook(() => useParty(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    // Storage emptying is the observable that proves the mount probe ran and found nothing.
    await waitFor(() => expect(readConnectedWallet()).toBe(undefined))
    expect(result.current.wallet).toBe(undefined)
  })

  it('forgets the wallet on disconnect', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-forget',
      target: 'wallet-forget',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result } = renderHook(
      () => ({ connect: useConnect(), picker: useWalletPicker(), party: useParty() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    let attempt: Promise<void> | undefined
    act(() => {
      attempt = result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.picker.isOpen).toBe(true))

    await act(async () => {
      result.current.picker.select('browser:ext:wallet-forget')
      await attempt
    })

    expect(readConnectedWallet()).toEqual({
      providerId: 'browser:ext:wallet-forget',
      name: 'wallet-forget',
    })

    await act(async () => {
      await result.current.connect.disconnect()
    })

    wallet.dispose()

    expect(result.current.party.wallet).toBe(undefined)
    expect(readConnectedWallet()).toBe(undefined)
  })

  it('stores the newly selected wallet when it lands locked, not the previously remembered one', async () => {
    const walletFirst = createFakeWallet({
      id: 'wallet-first',
      name: 'Wallet First',
      target: 'wallet-first',
      accounts: [{ partyId: 'alice::1', primary: true, status: 'allocated' }],
    })
    // connect()'s own internal status check sees connected; the recovery probe then finds it locked.
    const walletLocked = createFakeWallet({
      id: 'wallet-locked',
      name: 'Wallet Locked',
      target: 'wallet-locked',
      statusResponses: [true, false],
      accounts: [{ partyId: 'bob::2', primary: true, status: 'allocated' }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result } = renderHook(
      () => ({ connect: useConnect(), picker: useWalletPicker(), party: useParty() }),
      {
        wrapper: ({ children }) => (
          <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
        ),
      },
    )

    let attempt: Promise<void> | undefined
    act(() => {
      attempt = result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.picker.isOpen).toBe(true))

    await act(async () => {
      result.current.picker.select('browser:ext:wallet-first')
      await attempt
    })

    expect(readConnectedWallet()).toEqual({
      providerId: 'browser:ext:wallet-first',
      name: 'Wallet First',
    })

    // The account read fails after pairing, forcing the throw-then-probe landing on the locked wallet.
    vi.spyOn(DappSDK.prototype, 'listAccounts').mockRejectedValue(new Error('read exploded'))

    let retry: Promise<void> | undefined
    act(() => {
      retry = result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.picker.isOpen).toBe(true))

    await act(async () => {
      result.current.picker.select('browser:ext:wallet-locked')
      await expect(retry).rejects.toThrow('read exploded')
    })

    walletFirst.dispose()
    walletLocked.dispose()

    // The landing on the locked wallet's client replaced the record, even though the attempt failed.
    expect(result.current.party.status).toBe('connected')
    expect(result.current.party.wallet).toEqual({
      providerId: 'browser:ext:wallet-locked',
      name: 'Wallet Locked',
    })
    expect(readConnectedWallet()).toEqual({
      providerId: 'browser:ext:wallet-locked',
      name: 'Wallet Locked',
    })
  })

  it('runs no recovery when unmounted during a choice on a restored session', async () => {
    localStorage.setItem(
      KERNEL_DISCOVERY_KEY,
      JSON.stringify({ walletType: 'extension', providerId: 'browser:ext:wallet-a' }),
    )
    localStorage.setItem(
      DISCOVERY_SESSION_KEY,
      JSON.stringify({ providerId: 'browser:ext:wallet-a' }),
    )

    // Restore's check, ours, and any (forbidden) post-unmount probe all see a live session.
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      statusResponses: [true, true, true],
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const config = { appName: 'test', walletSelection: 'in-page' as const }
    const { result, unmount } = renderHook(() => useCantonConnectContext(), {
      wrapper: ({ children }) => (
        <CantonConnectProvider config={config}>{children}</CantonConnectProvider>
      ),
    })

    await waitFor(() => expect(result.current.party?.partyId).toBe('alice::1220ab'))

    let attempt: Promise<void> | undefined
    act(() => {
      attempt = result.current.connect()
    })

    await waitFor(() => expect(result.current.walletPicker.isOpen).toBe(true))

    // Re-wiring after unmount would leak listeners with no teardown left to remove them.
    const wireSpy = vi.spyOn(result.current.sdk, 'onAccountsChanged')

    const settled = expect(attempt).rejects.toBeInstanceOf(UserRejectedError)
    unmount()
    await settled

    wallet.dispose()

    expect(wireSpy).not.toHaveBeenCalled()
  })
})
