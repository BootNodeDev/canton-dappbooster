// The action hooks' guards: not connected, locked, and useExecute's own error surface.

import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useConnect } from '#src/hooks/useConnect'
import { useExecute } from '#src/hooks/useExecute'
import { useLedger } from '#src/hooks/useLedger'
import { useSignMessage } from '#src/hooks/useSignMessage'
import { useWalletStatus } from '#src/hooks/useWalletStatus'
import { createMockAdapter } from '#src/mock/mockAdapter'
import { createAutoPicker } from '#src/testing/autoPicker'
import { clearDiscoveryStorage, persistRestorableSession } from '#src/testing/discoveryStorage'
import { renderSession } from '#src/testing/renderSession'
import { walletA } from '#src/testing/walletA'
import { pushLock } from '#src/testing/walletLock'

const NOT_CONNECTED_MESSAGE = 'wallet is not connected - call useConnect().connect() first'
const LOCKED_MESSAGE = 'wallet is locked - unlock it in the wallet'

describe('CantonConnectProvider hook guards', () => {
  afterEach(() => {
    clearDiscoveryStorage()
  })

  it('useSignMessage throws its not-connected guard before connecting', async () => {
    const { result } = renderSession(() => useSignMessage())

    await expect(result.current.signMessage('hello')).rejects.toThrow(NOT_CONNECTED_MESSAGE)
  })

  it('useLedger throws its not-connected guard before connecting', async () => {
    const { result } = renderSession(() => useLedger())

    await expect(
      result.current.ledgerApi({ requestMethod: 'get', resource: '/v2/parties' }),
    ).rejects.toThrow(NOT_CONNECTED_MESSAGE)
  })

  it('useExecute throws its non-connected guard before connecting', async () => {
    const { result } = renderSession(() => useExecute())

    await expect(result.current.execute({ commands: [] })).rejects.toThrow(NOT_CONNECTED_MESSAGE)
  })

  it('sets useExecute().error on a failing execute and clears it on reset()', async () => {
    const mock = createMockAdapter({
      id: 'mock-execute',
      accounts: [{ partyId: 'alice::mock1220' }],
    })

    const { result } = renderSession(() => ({ connect: useConnect(), execute: useExecute() }), {
      additionalAdapters: [mock],
      walletPicker: createAutoPicker('mock-execute'),
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

  it('rejects execute while the wallet is locked', async () => {
    persistRestorableSession('browser:ext:wallet-a')

    const wallet = walletA()

    const { result } = renderSession(() => ({ status: useWalletStatus(), execute: useExecute() }))

    // A status() read cannot report a locked session: the wallet gates `isConnected` and the
    // presence of `session` on the same lookup. A lock only ever arrives as a push.
    await waitFor(() => expect(result.current.status.isConnected).toBe(true))

    act(() => {
      pushLock(wallet)
    })

    await waitFor(() => expect(result.current.status.isLocked).toBe(true))

    await act(async () => {
      await expect(result.current.execute.execute({ commands: [] })).rejects.toThrow(LOCKED_MESSAGE)
    })

    wallet.dispose()
  })

  it('rejects signMessage while the wallet is locked', async () => {
    persistRestorableSession('browser:ext:wallet-a')

    const wallet = walletA()

    const { result } = renderSession(() => ({ status: useWalletStatus(), sign: useSignMessage() }))

    // A status() read cannot report a locked session: the wallet gates `isConnected` and the
    // presence of `session` on the same lookup. A lock only ever arrives as a push.
    await waitFor(() => expect(result.current.status.isConnected).toBe(true))

    act(() => {
      pushLock(wallet)
    })

    await waitFor(() => expect(result.current.status.isLocked).toBe(true))

    await act(async () => {
      await expect(result.current.sign.signMessage('hello')).rejects.toThrow(LOCKED_MESSAGE)
    })

    wallet.dispose()
  })

  it('rejects ledgerApi and reports not ready while the wallet is locked', async () => {
    persistRestorableSession('browser:ext:wallet-a')

    const wallet = walletA()

    const { result } = renderSession(() => ({ status: useWalletStatus(), ledger: useLedger() }))

    // A status() read cannot report a locked session: the wallet gates `isConnected` and the
    // presence of `session` on the same lookup. A lock only ever arrives as a push.
    await waitFor(() => expect(result.current.status.isConnected).toBe(true))

    act(() => {
      pushLock(wallet)
    })

    await waitFor(() => expect(result.current.status.isLocked).toBe(true))

    expect(result.current.ledger.isReady).toBe(false)

    await act(async () => {
      await expect(
        result.current.ledger.ledgerApi({ requestMethod: 'get', resource: '/v2/parties' }),
      ).rejects.toThrow(LOCKED_MESSAGE)
    })

    wallet.dispose()
  })
})
